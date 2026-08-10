import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, rgb, type PDFDocument, type PDFPage } from "@cantoo/pdf-lib";

import { createPdf, loadPdf, savePdf } from "@/lib/pdf/document";
import {
  anchorPosition,
  embedStandardFont,
  hexToRgb,
  toWinAnsi,
  type Anchor,
  type FontChoice,
} from "@/lib/pdf/fonts";
import { parsePageRange } from "@/lib/pdf/pages";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

// --------------------------------------------------------- page numbers

export async function pageNumbers(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const total = doc.getPageCount();

  const o = ctx.options;
  const anchor = (o.position as Anchor) ?? "bottom-center";
  const fontChoice = (o.font as FontChoice) ?? "helvetica";
  const size = Math.min(72, Math.max(6, Number(o.fontSize ?? 12)));
  const margin = Math.max(0, Number(o.margin ?? 32));
  const startAt = Number(o.startNumber ?? 1);
  const format = (o.format as string) ?? "n";
  const color = hexToRgb(String(o.color ?? "#000000"));

  const targets = new Set(parsePageRange(String(o.pages ?? ""), total));
  const font = await embedStandardFont(doc, fontChoice, o.bold === true);

  let stamped = 0;

  doc.getPages().forEach((page, i) => {
    const pageNo = i + 1;
    if (!targets.has(pageNo)) return;

    const shown = startAt + i;
    const totalShown = startAt + total - 1;
    const label =
      format === "n-of-N"
        ? `${shown} / ${totalShown}`
        : format === "page-n-of-N"
          ? `Page ${shown} of ${totalShown}`
          : `${shown}`;

    const text = toWinAnsi(label);
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    const { width, height } = page.getSize();
    const { x, y } = anchorPosition(anchor, width, height, textWidth, textHeight, margin);

    page.drawText(text, { x, y, size, font, color: rgb(color.r, color.g, color.b) });
    stamped += 1;
  });

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-numbered.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, numbered: stamped },
  };
}

// ------------------------------------------------------------ watermark

export async function watermark(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const source = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const o = ctx.options;

  /*
   * Over the content: append operators to the existing pages, which preserves
   * annotations, links and form fields.
   *
   * Under the content: operators cannot be prepended, so those pages are rebuilt
   * — blank page, watermark, then the original page stamped on top as an
   * embedded XObject. That flattens interactive content, so it only happens when
   * the user explicitly picks it.
   */
  const below = o.layer === "below";

  const doc = below ? await createPdf() : source;
  const total = source.getPageCount();

  // For the underlay path, prepare blank pages plus the original page XObjects.
  let underlay: { page: PDFPage; stamp: () => void }[] = [];
  if (below) {
    const indices = source.getPageIndices();
    const embedded = await doc.embedPdf(source, indices);
    underlay = embedded.map((embeddedPage, i) => {
      const original = source.getPage(indices[i]);
      const { width, height } = original.getSize();
      const page = doc.addPage([width, height]);
      page.setRotation(original.getRotation());
      return {
        page,
        stamp: () => page.drawPage(embeddedPage, { x: 0, y: 0, width, height }),
      };
    });
  }

  const mode = (o.mode as string) ?? "text";
  const anchor = (o.position as Anchor) ?? "middle-center";
  const opacity = Math.min(1, Math.max(0.05, Number(o.opacity ?? 0.35)));
  const rotation = Number(o.rotation ?? 45);
  const tile = o.tile === true;
  const margin = Math.max(0, Number(o.margin ?? 32));
  const imageScale = Math.min(1, Math.max(0.05, Number(o.imageScale ?? 0.4)));

  const targets = new Set(parsePageRange(String(o.pages ?? ""), total));

  // Image watermarks come from a second uploaded file.
  let image: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  if (mode === "image") {
    const imageInput = ctx.inputs[1];
    if (!imageInput) throw new Error("Select an image to use as the watermark");
    const bytes = await readFile(imageInput.path);
    const ext = path.extname(imageInput.name).toLowerCase();
    image =
      ext === ".jpg" || ext === ".jpeg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  }

  const text = toWinAnsi(String(o.text ?? "XTools"));
  const size = Math.min(200, Math.max(8, Number(o.fontSize ?? 48)));
  const font = await embedStandardFont(doc, (o.font as FontChoice) ?? "helvetica", o.bold === true);
  const color = hexToRgb(String(o.color ?? "#888888"));

  let stamped = 0;
  const pages = below ? underlay.map((u) => u.page) : doc.getPages();

  pages.forEach((page, i) => {
    if (!targets.has(i + 1)) {
      // Still needs the original content, even without a watermark.
      if (below) underlay[i].stamp();
      return;
    }

    const { width, height } = page.getSize();

    const drawOne = (x: number, y: number) => {
      if (image) {
        const dims = image.scale(1);
        const targetWidth = width * imageScale;
        const scale = targetWidth / dims.width;
        page.drawImage(image, {
          x,
          y,
          width: dims.width * scale,
          height: dims.height * scale,
          opacity,
          rotate: degrees(rotation),
        });
      } else {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(rotation),
        });
      }
    };

    let contentWidth: number;
    let contentHeight: number;
    if (image) {
      const dims = image.scale(1);
      contentWidth = width * imageScale;
      contentHeight = (dims.height / dims.width) * contentWidth;
    } else {
      contentWidth = font.widthOfTextAtSize(text, size);
      contentHeight = font.heightAtSize(size);
    }

    if (tile) {
      const stepX = Math.max(40, contentWidth * 1.8);
      const stepY = Math.max(40, contentHeight * 4);
      for (let y = margin; y < height; y += stepY) {
        for (let x = margin; x < width; x += stepX) drawOne(x, y);
      }
    } else {
      const { x, y } = anchorPosition(anchor, width, height, contentWidth, contentHeight, margin);
      drawOne(x, y);
    }

    // Original content goes on last so the watermark ends up beneath it.
    if (below) underlay[i].stamp();
    stamped += 1;
  });

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-watermarked.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, watermarked: stamped },
  };
}

// ----------------------------------------------------------------- crop

export async function crop(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const total = doc.getPageCount();

  const o = ctx.options;
  const targets = new Set(parsePageRange(String(o.pages ?? ""), total));

  /*
   * The editor sends the crop box as fractions of the page (0..1) measured from
   * the top-left, which is resolution independent. PDF space is bottom-left, so
   * `top` maps to the far edge and `bottom` to the origin.
   */
  const left = clampFraction(Number(o.left ?? 0));
  const top = clampFraction(Number(o.top ?? 0));
  const right = clampFraction(Number(o.right ?? 0));
  const bottom = clampFraction(Number(o.bottom ?? 0));

  if (left + right >= 1 || top + bottom >= 1) {
    throw new Error("The crop area would remove the entire page");
  }

  let cropped = 0;

  doc.getPages().forEach((page, i) => {
    if (!targets.has(i + 1)) return;

    const box = page.getMediaBox();
    const newX = box.x + box.width * left;
    const newY = box.y + box.height * bottom;
    const newWidth = box.width * (1 - left - right);
    const newHeight = box.height * (1 - top - bottom);

    page.setCropBox(newX, newY, newWidth, newHeight);
    cropped += 1;
  });

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-cropped.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, cropped },
  };
}

function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(0.95, Math.max(0, value)) : 0;
}
