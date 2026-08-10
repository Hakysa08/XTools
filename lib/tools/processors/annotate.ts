import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";

import { loadPdf, savePdf } from "@/lib/pdf/document";
import { embedStandardFont, hexToRgb, toWinAnsi, type FontChoice } from "@/lib/pdf/fonts";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

/**
 * A drawing produced by the canvas editor. Every coordinate is a fraction of the
 * page with a top-left origin, so it survives any zoom level the editor used.
 */
export interface Annotation {
  type: "text" | "rect" | "ellipse" | "line" | "freehand" | "highlight" | "image";
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Freehand and line points, as page fractions. */
  points?: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  font?: FontChoice;
  color?: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
  /** Data URL for an image stamp. */
  image?: string;
}

export async function editPdf(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const total = doc.getPageCount();

  const annotations = (
    Array.isArray(ctx.options.annotations) ? ctx.options.annotations : []
  ) as Annotation[];

  if (annotations.length === 0) {
    throw new Error("Add something to the document first");
  }

  const fontCache = new Map<string, Awaited<ReturnType<typeof embedStandardFont>>>();
  const fontFor = async (choice: FontChoice) => {
    const key = choice ?? "helvetica";
    if (!fontCache.has(key)) fontCache.set(key, await embedStandardFont(doc, key));
    return fontCache.get(key)!;
  };

  let drawn = 0;

  for (const item of annotations) {
    if (item.page < 1 || item.page > total) continue;
    const page = doc.getPage(item.page - 1);
    const { width: pw, height: ph } = page.getSize();

    const stroke = hexToRgb(item.color ?? "#e11d48");
    const opacity = Math.min(1, Math.max(0.05, item.opacity ?? 1));
    const thickness = Math.max(0.5, (item.strokeWidth ?? 2));

    // Convert a top-left fraction into PDF's bottom-left point space.
    const px = (v: number) => v * pw;
    const py = (v: number) => ph - v * ph;

    switch (item.type) {
      case "text": {
        const font = await fontFor(item.font ?? "helvetica");
        const size = Math.max(4, item.fontSize ?? 14);
        page.drawText(toWinAnsi(item.text ?? ""), {
          x: px(item.x),
          // drawText anchors at the baseline, so drop by the cap height.
          y: py(item.y) - size,
          size,
          font,
          color: rgb(stroke.r, stroke.g, stroke.b),
          opacity,
        });
        break;
      }

      case "rect": {
        const w = px(item.width ?? 0);
        const h = (item.height ?? 0) * ph;
        const fill = item.fill ? hexToRgb(item.fill) : null;
        page.drawRectangle({
          x: px(item.x),
          y: py(item.y) - h,
          width: w,
          height: h,
          borderColor: rgb(stroke.r, stroke.g, stroke.b),
          borderWidth: thickness,
          color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
          opacity: fill ? opacity : undefined,
          borderOpacity: opacity,
        });
        break;
      }

      case "highlight": {
        const w = px(item.width ?? 0);
        const h = (item.height ?? 0) * ph;
        const fill = hexToRgb(item.fill ?? item.color ?? "#fde047");
        page.drawRectangle({
          x: px(item.x),
          y: py(item.y) - h,
          width: w,
          height: h,
          color: rgb(fill.r, fill.g, fill.b),
          // Translucent so the text underneath stays readable.
          opacity: Math.min(0.6, item.opacity ?? 0.35),
        });
        break;
      }

      case "ellipse": {
        const w = px(item.width ?? 0);
        const h = (item.height ?? 0) * ph;
        const fill = item.fill ? hexToRgb(item.fill) : null;
        page.drawEllipse({
          x: px(item.x) + w / 2,
          y: py(item.y) - h / 2,
          xScale: Math.max(0.5, w / 2),
          yScale: Math.max(0.5, h / 2),
          borderColor: rgb(stroke.r, stroke.g, stroke.b),
          borderWidth: thickness,
          color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
          opacity: fill ? opacity : undefined,
          borderOpacity: opacity,
        });
        break;
      }

      case "line":
      case "freehand": {
        const points = item.points ?? [];
        if (points.length < 2) break;
        for (let i = 1; i < points.length; i += 1) {
          page.drawLine({
            start: { x: px(points[i - 1].x), y: py(points[i - 1].y) },
            end: { x: px(points[i].x), y: py(points[i].y) },
            thickness,
            color: rgb(stroke.r, stroke.g, stroke.b),
            opacity,
          });
        }
        break;
      }

      case "image": {
        const dataUrl = item.image ?? "";
        if (!dataUrl.startsWith("data:image/")) break;
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
        const embedded = dataUrl.includes("image/jpeg")
          ? await doc.embedJpg(bytes)
          : await doc.embedPng(bytes);
        const w = px(item.width ?? 0.2);
        const h = (item.height ?? 0.1) * ph;
        page.drawImage(embedded, { x: px(item.x), y: py(item.y) - h, width: w, height: h, opacity });
        break;
      }
    }

    drawn += 1;
  }

  if (drawn === 0) throw new Error("Nothing could be placed on those pages");

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-edited.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, annotations: drawn },
  };
}

// ------------------------------------------------------------ PDF forms

export interface FormFieldSpec {
  type: "text" | "checkbox" | "radio" | "dropdown";
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  options?: string[];
  required?: boolean;
}

/**
 * Creates interactive AcroForm fields, and fills any that already exist.
 */
export async function pdfForms(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const total = doc.getPageCount();
  const form = doc.getForm();

  const specs = (Array.isArray(ctx.options.fields) ? ctx.options.fields : []) as FormFieldSpec[];
  const fills = (ctx.options.values ?? {}) as Record<string, string>;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  let created = 0;
  let filled = 0;

  // Fill existing fields first, before any new ones are added.
  for (const [name, value] of Object.entries(fills)) {
    try {
      const field = form.getFieldMaybe(name);
      if (!field) continue;

      const kind = field.constructor.name;
      if (kind === "PDFTextField") {
        form.getTextField(name).setText(value);
      } else if (kind === "PDFCheckBox") {
        const box = form.getCheckBox(name);
        if (value === "true" || value === "on" || value === "1") box.check();
        else box.uncheck();
      } else if (kind === "PDFDropdown") {
        form.getDropdown(name).select(value);
      } else if (kind === "PDFRadioGroup") {
        form.getRadioGroup(name).select(value);
      }
      filled += 1;
    } catch {
      // A malformed field should not fail the whole job.
    }
  }

  const used = new Set<string>();

  for (const spec of specs) {
    if (spec.page < 1 || spec.page > total) continue;
    const page = doc.getPage(spec.page - 1);
    const { width: pw, height: ph } = page.getSize();

    // Field names must be unique within a document.
    let name = spec.name?.trim() || `${spec.type}_${created + 1}`;
    while (used.has(name) || form.getFieldMaybe(name)) name = `${name}_`;
    used.add(name);

    const rect = {
      x: spec.x * pw,
      y: ph - spec.y * ph - spec.height * ph,
      width: spec.width * pw,
      height: spec.height * ph,
    };

    try {
      if (spec.type === "text") {
        const field = form.createTextField(name);
        if (spec.value) field.setText(spec.value);
        field.addToPage(page, { ...rect, font, borderWidth: 1 });
      } else if (spec.type === "checkbox") {
        const field = form.createCheckBox(name);
        field.addToPage(page, rect);
        if (spec.value === "true") field.check();
      } else if (spec.type === "dropdown") {
        const field = form.createDropdown(name);
        field.addOptions(spec.options?.length ? spec.options : ["Option 1", "Option 2"]);
        if (spec.value) field.select(spec.value);
        field.addToPage(page, { ...rect, font, borderWidth: 1 });
      } else if (spec.type === "radio") {
        const group = form.createRadioGroup(name);
        for (const option of spec.options?.length ? spec.options : ["A", "B"]) {
          group.addOptionToPage(option, page, rect);
        }
        if (spec.value) group.select(spec.value);
      }
      created += 1;
    } catch {
      // Skip a field the document will not accept.
    }
  }

  if (created === 0 && filled === 0) {
    throw new Error("Add a form field, or fill one that already exists");
  }

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-form.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, fieldsCreated: created, fieldsFilled: filled },
  };
}
