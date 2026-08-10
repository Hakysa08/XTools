import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadPdf } from "@/lib/pdf/document";
import { assertSafeUrl, htmlStringToPdf, urlToPdf, type PaperFormat } from "@/lib/pdf/html";
import { officeToPdf } from "@/lib/pdf/office";
import { extractTextItems, itemsToLines, renderPages, type PageText } from "@/lib/pdf/render";
import { extensionOf, stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

// ------------------------------------------------------ office -> pdf

export async function officeToPdfProcessor(ctx: ProcessContext): Promise<ProcessResult> {
  const outputs: { name: string; size: number }[] = [];
  let engine = "";

  for (const input of ctx.inputs) {
    const data = await readFile(input.path);
    const ext = extensionOf(input.name);
    const baseName = stripExtension(path.basename(input.name));

    const result = await officeToPdf(data, ext, baseName, {
      format: (ctx.options.format as PaperFormat) ?? "A4",
      landscape: ctx.options.landscape === true,
    });
    engine = result.engine;

    const file = await writeOutput(ctx.taskId, `${baseName}.pdf`, result.pdf);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { files: ctx.inputs.length, engine } };
}

// -------------------------------------------------------- html -> pdf

export async function htmlToPdfProcessor(ctx: ProcessContext): Promise<ProcessResult> {
  const format = (ctx.options.format as PaperFormat) ?? "A4";
  const landscape = ctx.options.landscape === true;
  const margin = String(ctx.options.margin ?? "12mm");
  const rawUrl = String(ctx.options.url ?? "").trim();

  // A pasted address wins over an uploaded file.
  if (rawUrl) {
    const url = assertSafeUrl(rawUrl);
    const pdf = await urlToPdf(url.href, { format, landscape, margin, settleMs: 400 });
    const name = `${url.hostname.replace(/^www\./, "")}.pdf`;
    const file = await writeOutput(ctx.taskId, name, pdf);
    return { outputs: [{ name: file.name, size: file.size }], stats: { source: url.href } };
  }

  if (ctx.inputs.length === 0) {
    throw new Error("Enter a web address or upload an HTML file");
  }

  const outputs: { name: string; size: number }[] = [];
  for (const input of ctx.inputs) {
    const html = await readFile(input.path, "utf8");
    const pdf = await htmlStringToPdf(html, { format, landscape, margin });
    const baseName = stripExtension(path.basename(input.name));
    const file = await writeOutput(ctx.taskId, `${baseName}.pdf`, pdf);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { files: ctx.inputs.length } };
}

// -------------------------------------------------------- pdf -> word

/** Font size drives a rough heading guess, since PDFs carry no structure. */
function classifyLine(text: string, size: number, bodySize: number) {
  if (size >= bodySize * 1.6) return "Heading1" as const;
  if (size >= bodySize * 1.25) return "Heading2" as const;
  return null;
}

export async function pdfToWord(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const pages = await extractTextItems({ data });
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import("docx");

  // The most common glyph height is a good proxy for body text.
  const sizes = pages.flatMap((p) => p.items.map((i) => Math.round(i.height)));
  const bodySize = mode(sizes) || 10;

  const children: InstanceType<typeof Paragraph>[] = [];
  let totalLines = 0;

  pages.forEach((page, pageIndex) => {
    const lines = groupLines(page);

    for (const line of lines) {
      if (!line.text) continue;
      totalLines += 1;

      const heading = classifyLine(line.text, line.size, bodySize);
      children.push(
        new Paragraph({
          heading:
            heading === "Heading1"
              ? HeadingLevel.HEADING_1
              : heading === "Heading2"
                ? HeadingLevel.HEADING_2
                : undefined,
          children: [
            new TextRun({
              text: line.text,
              // docx sizes are in half-points.
              size: heading ? undefined : Math.round(line.size * 2),
              bold: line.bold || undefined,
            }),
          ],
          spacing: { after: 120 },
        }),
      );
    }

    if (pageIndex < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  // Count real lines, not `children`: page-break paragraphs are pushed even for
  // an image-only PDF, so checking children would let an empty file through.
  if (totalLines === 0) {
    throw new Error(
      "No text could be found in this PDF. If it is a scan, run OCR PDF on it first.",
    );
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const bytes = Buffer.from(await Packer.toBuffer(doc));
  const file = await writeOutput(ctx.taskId, `${baseName}.docx`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: pages.length, lines: totalLines },
  };
}

// ------------------------------------------------------- pdf -> excel

export async function pdfToExcel(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const pages = await extractTextItems({ data });
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "XTools";

  let totalRows = 0;

  for (const page of pages) {
    const sheet = workbook.addWorksheet(`Page ${page.page}`);
    const rows = buildTable(page);

    for (const row of rows) {
      sheet.addRow(row);
      totalRows += 1;
    }

    // Rough auto-fit so the sheet is readable on open.
    sheet.columns.forEach((column) => {
      let widest = 10;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        widest = Math.max(widest, String(cell.value ?? "").length + 2);
      });
      column.width = Math.min(60, widest);
    });
  }

  if (totalRows === 0) {
    throw new Error(
      "No text could be found in this PDF. If it is a scan, run OCR PDF on it first.",
    );
  }

  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const file = await writeOutput(ctx.taskId, `${baseName}.xlsx`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: pages.length, rows: totalRows },
  };
}

// -------------------------------------------------- pdf -> powerpoint

export async function pdfToPowerpoint(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const doc = await loadPdf(data, { ignoreEncryption: true });
  const total = doc.getPageCount();
  const first = doc.getPage(0).getSize();
  const landscape = first.width >= first.height;

  const rendered = await renderPages(
    { data },
    Array.from({ length: total }, (_, i) => i + 1),
    { dpi: Number(ctx.options.dpi ?? 150), format: "jpeg", quality: 85, background: "#ffffff" },
  );

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = landscape ? "LAYOUT_16x9" : "LAYOUT_4x3";

  // Slide dimensions in inches, matching the layout chosen above.
  const slideW = landscape ? 10 : 10;
  const slideH = landscape ? 5.625 : 7.5;

  for (const image of rendered) {
    const slide = pptx.addSlide();
    // Letterbox the page so its aspect ratio is preserved.
    const pageRatio = image.width / image.height;
    const slideRatio = slideW / slideH;

    let w = slideW;
    let h = slideH;
    if (pageRatio > slideRatio) h = slideW / pageRatio;
    else w = slideH * pageRatio;

    slide.addImage({
      data: `data:image/jpeg;base64,${image.buffer.toString("base64")}`,
      x: (slideW - w) / 2,
      y: (slideH - h) / 2,
      w,
      h,
    });
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const file = await writeOutput(ctx.taskId, `${baseName}.pptx`, out);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, slides: rendered.length },
  };
}

// ------------------------------------------------------------ helpers

interface Line {
  text: string;
  size: number;
  bold: boolean;
  y: number;
}

/** Groups text items into visual lines, keeping the dominant font size. */
function groupLines(page: PageText): Line[] {
  const buckets = new Map<number, typeof page.items>();

  for (const item of page.items) {
    const key = [...buckets.keys()].find((k) => Math.abs(k - item.y) <= 3);
    if (key === undefined) buckets.set(item.y, [item]);
    else buckets.get(key)!.push(item);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, items]) => {
      const sorted = [...items].sort((a, b) => a.x - b.x);
      const text = joinWithGaps(sorted);
      const size = Math.max(...sorted.map((i) => i.height));
      const bold = sorted.some((i) => /bold|black|heavy/i.test(i.fontName));
      return { text, size, bold, y };
    })
    .filter((line) => line.text.length > 0);
}

/** Inserts a space where items are visually separated but not adjacent. */
function joinWithGaps(items: PageText["items"]): string {
  let out = "";
  let prevEnd: number | null = null;

  for (const item of items) {
    if (prevEnd !== null) {
      const gap = item.x - prevEnd;
      // A gap wider than a quarter of the glyph height reads as a space.
      if (gap > item.height * 0.25 && !out.endsWith(" ")) out += " ";
    }
    out += item.text;
    prevEnd = item.x + item.width;
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Turns positioned text into a grid by clustering x-positions into columns.
 * Real PDFs carry no table markup, so this is a heuristic reconstruction.
 */
function buildTable(page: PageText): string[][] {
  const rows = new Map<number, typeof page.items>();

  for (const item of page.items) {
    const key = [...rows.keys()].find((k) => Math.abs(k - item.y) <= 3);
    if (key === undefined) rows.set(item.y, [item]);
    else rows.get(key)!.push(item);
  }

  // Column boundaries come from the x-positions seen across all rows.
  const starts = [...page.items.map((i) => Math.round(i.x))].sort((a, b) => a - b);
  const columns: number[] = [];
  for (const x of starts) {
    if (!columns.some((c) => Math.abs(c - x) < 18)) columns.push(x);
  }
  columns.sort((a, b) => a - b);

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => {
      const cells = new Array<string>(Math.max(1, columns.length)).fill("");
      for (const item of [...items].sort((a, b) => a.x - b.x)) {
        let index = 0;
        for (let c = 0; c < columns.length; c += 1) {
          if (item.x >= columns[c] - 18) index = c;
        }
        cells[index] = cells[index] ? `${cells[index]} ${item.text}` : item.text;
      }
      return cells.map((c) => c.replace(/\s+/g, " ").trim());
    })
    .filter((row) => row.some((cell) => cell.length > 0));
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export { itemsToLines };
