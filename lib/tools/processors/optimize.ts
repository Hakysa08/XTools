import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createPdf, loadPdf, savePdf, PdfError } from "@/lib/pdf/document";
import { recompressEmbeddedImages } from "@/lib/pdf/images";
import { renderPages } from "@/lib/pdf/render";
import { numbered } from "@/lib/pdf/zip";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

type Level = "low" | "recommended" | "extreme";

interface LevelSettings {
  /** Raster fallback resolution. */
  dpi: number;
  quality: number;
  /** Longest edge allowed for an embedded image when recompressing in place. */
  maxPixels: number;
  /** Whether the destructive whole-page raster is even attempted. */
  allowRaster: boolean;
}

const LEVELS: Record<Level, LevelSettings> = {
  low: { dpi: 200, quality: 88, maxPixels: 2200, allowRaster: false },
  recommended: { dpi: 144, quality: 75, maxPixels: 1600, allowRaster: false },
  extreme: { dpi: 96, quality: 50, maxPixels: 1100, allowRaster: true },
};

// ------------------------------------------------------------- compress

export async function compress(ctx: ProcessContext): Promise<ProcessResult> {
  const level = ((ctx.options.level as Level) ?? "recommended") satisfies Level;
  const settings = LEVELS[level] ?? LEVELS.recommended;

  const outputs: { name: string; size: number }[] = [];
  let originalTotal = 0;
  let newTotal = 0;

  let imagesRewritten = 0;
  let usedRaster = false;

  for (const input of ctx.inputs) {
    const data = await readFile(input.path);
    originalTotal += data.byteLength;

    /*
     * Preferred strategy: shrink the embedded images and leave everything else
     * alone. Text stays real text, and in image-heavy documents that is where
     * nearly all the bytes live anyway.
     */
    const doc = await loadPdf(data, { ignoreEncryption: true });
    const report = await recompressEmbeddedImages(doc, {
      maxPixels: settings.maxPixels,
      jpegQuality: settings.quality,
    });
    imagesRewritten += report.imagesRewritten;

    // Re-saving with object streams also squeezes out a few percent on its own.
    let best = await savePdf(doc);

    /*
     * Only "extreme" falls back to flattening whole pages to JPEG. It wrecks
     * text selection, so it has to earn its place by being meaningfully smaller.
     */
    if (settings.allowRaster) {
      const raster = await rasterizeDocument(data, settings);
      if (raster && raster.byteLength < best.byteLength * 0.9) {
        best = raster;
        usedRaster = true;
      }
    }

    // Never hand back something bigger than what was uploaded.
    if (best.byteLength >= data.byteLength) best = data;

    newTotal += best.byteLength;

    const baseName = stripExtension(path.basename(input.name));
    const file = await writeOutput(ctx.taskId, `${baseName}-compressed.pdf`, best);
    outputs.push({ name: file.name, size: file.size });
  }

  return {
    outputs,
    stats: {
      originalSize: originalTotal,
      newSize: newTotal,
      level,
      imagesRewritten,
      method: usedRaster ? "rasterized" : "images-recompressed",
    },
  };
}

/** Flattens every page to a JPEG. Destroys text, so it is a last resort. */
async function rasterizeDocument(
  data: Buffer,
  settings: LevelSettings,
): Promise<Buffer | null> {
  try {
    const source = await loadPdf(data, { ignoreEncryption: true });
    const pageCount = source.getPageCount();
    const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);

    const rendered = await renderPages({ data }, pageNumbers, {
      dpi: settings.dpi,
      format: "jpeg",
      quality: settings.quality,
      background: "#ffffff",
      maxEdge: 2600,
    });

    const rasterDoc = await createPdf();

    for (let i = 0; i < rendered.length; i += 1) {
      const jpeg = await sharp(rendered[i].buffer)
        .jpeg({ quality: settings.quality, mozjpeg: true })
        .toBuffer();
      const embedded = await rasterDoc.embedJpg(jpeg);

      // Keep the original page dimensions so the document still prints correctly.
      const { width, height } = source.getPage(i).getSize();
      const page = rasterDoc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }

    return await savePdf(rasterDoc);
  } catch {
    return null;
  }
}

// --------------------------------------------------------------- repair

export async function repair(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  let rebuilt: Buffer | null = null;
  let strategy = "reparse";

  // 1. Most forgiving pdf-lib parse, ignoring broken cross-reference data.
  try {
    const doc = await loadPdf(data, { ignoreEncryption: true });
    rebuilt = await savePdf(doc);
  } catch {
    rebuilt = null;
  }

  // 2. Rebuild page by page, dropping whatever cannot be copied.
  if (!rebuilt) {
    try {
      const source = await loadPdf(data, { ignoreEncryption: true });
      const out = await createPdf();
      const indices = source.getPageIndices();
      let recovered = 0;

      for (const index of indices) {
        try {
          const [page] = await out.copyPages(source, [index]);
          out.addPage(page);
          recovered += 1;
        } catch {
          // Skip the damaged page and keep going.
        }
      }
      if (recovered > 0) {
        rebuilt = await savePdf(out);
        strategy = "page-recovery";
      }
    } catch {
      rebuilt = null;
    }
  }

  if (!rebuilt) {
    throw new PdfError(
      "This file is too damaged to recover — no readable pages were found",
      "corrupt",
    );
  }

  const file = await writeOutput(ctx.taskId, `${baseName}-repaired.pdf`, rebuilt);
  const before = (await stat(input.path)).size;

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { originalSize: before, newSize: file.size, strategy },
  };
}

// ------------------------------------------------------------- PDF/A

export async function pdfToPdfA(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const doc = await loadPdf(data, { ignoreEncryption: true });

  const conformance = (ctx.options.conformance as "1B" | "2B" | "3B" | undefined) ?? "2B";

  // Adds the OutputIntent, embedded sRGB profile, document /ID and PDF/A XMP.
  doc.convertToPDFA({ conformance });

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-pdfa.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: doc.getPageCount(), conformance: `PDF/A-${conformance}` },
  };
}

// ---------------------------------------------------------- pdf to jpg

export async function pdfToJpg(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const dpi = Math.min(300, Math.max(72, Number(ctx.options.dpi ?? 150)));
  const format = (ctx.options.format as "jpeg" | "png") ?? "jpeg";
  const quality = Math.min(100, Math.max(30, Number(ctx.options.quality ?? 85)));

  const doc = await loadPdf(data, { ignoreEncryption: true });
  const total = doc.getPageCount();
  const pageNumbers = Array.from({ length: total }, (_, i) => i + 1);

  const rendered = await renderPages({ data }, pageNumbers, {
    dpi,
    format,
    quality,
    background: format === "jpeg" ? "#ffffff" : undefined,
    maxEdge: 5000,
  });

  const outputs: { name: string; size: number }[] = [];
  const ext = format === "png" ? "png" : "jpg";

  for (let i = 0; i < rendered.length; i += 1) {
    const name = `${baseName}-${numbered(i + 1, total)}.${ext}`;
    const file = await writeOutput(ctx.taskId, name, rendered[i].buffer);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { pages: total, dpi } };
}
