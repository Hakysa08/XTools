import "server-only";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { StandardFonts, degrees } from "@cantoo/pdf-lib";

import { createPdf, loadPdf, savePdf } from "@/lib/pdf/document";
import { toWinAnsi } from "@/lib/pdf/fonts";
import { renderPages } from "@/lib/pdf/render";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

/** Tesseract traineddata codes we expose. */
const LANGS: Record<string, string> = {
  eng: "eng",
  ind: "ind",
  "ind+eng": "ind+eng",
};

interface OcrWord {
  text: string;
  /** Pixel bounding box in the rendered image. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

/**
 * Rasterises each page, runs Tesseract over it, then writes the recognised words
 * back as an *invisible* text layer (rendering mode 3) positioned over the
 * matching pixels. The result looks identical but is searchable and selectable.
 */
export async function ocr(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const langKey = String(ctx.options.language ?? "ind+eng");
  const lang = LANGS[langKey] ?? LANGS["ind+eng"];
  const dpi = Math.min(300, Math.max(150, Number(ctx.options.dpi ?? 200)));
  const keepOriginal = ctx.options.keepOriginal !== false;

  const source = await loadPdf(data, { ignoreEncryption: true });
  const total = source.getPageCount();
  const pageNumbers = Array.from({ length: total }, (_, i) => i + 1);

  const rendered = await renderPages({ data }, pageNumbers, {
    dpi,
    format: "png",
    background: "#ffffff",
    maxEdge: 3500,
  });

  const { createWorker } = await import("tesseract.js");

  /*
   * Language data is several megabytes and is downloaded on first use. Keep it
   * under storage/ instead of the project root, and out of the retention sweep.
   */
  const cachePath = path.join(process.cwd(), "storage", "tessdata");
  await mkdir(cachePath, { recursive: true });

  const worker = await createWorker(lang, undefined, { cachePath });

  let wordsFound = 0;

  try {
    // Start from the original so vector content and fonts survive; fall back to
    // the raster when the user asked for a flattened output.
    const out = keepOriginal ? source : await createPdf();
    const font = await out.embedFont(StandardFonts.Helvetica);

    const embeddedRasters = keepOriginal
      ? []
      : await Promise.all(rendered.map((r) => out.embedPng(r.buffer)));

    for (let i = 0; i < rendered.length; i += 1) {
      const image = rendered[i];
      const { data: result } = await worker.recognize(
        image.buffer,
        {},
        { blocks: true },
      );

      const words = collectWords(result);

      const sourcePage = source.getPage(i);
      const { width: pageWidth, height: pageHeight } = sourcePage.getSize();

      const page = keepOriginal ? out.getPage(i) : out.addPage([pageWidth, pageHeight]);
      if (!keepOriginal) {
        page.drawImage(embeddedRasters[i], { x: 0, y: 0, width: pageWidth, height: pageHeight });
      }

      // Rendered pixels -> PDF points.
      const scaleX = pageWidth / image.width;
      const scaleY = pageHeight / image.height;

      for (const word of words) {
        const text = toWinAnsi(word.text.trim());
        if (!text || word.confidence < 30) continue;

        const boxWidth = (word.x1 - word.x0) * scaleX;
        const boxHeight = (word.y1 - word.y0) * scaleY;
        if (boxWidth <= 0 || boxHeight <= 0) continue;

        // pdf.js measures from the top; PDF space measures from the bottom.
        const x = word.x0 * scaleX;
        const y = pageHeight - word.y1 * scaleY;

        /*
         * Size the invisible word so its natural width matches the scanned word
         * it covers, keeping selection roughly aligned.
         *
         * Character spacing is deliberately left at zero: padding the gaps to
         * force a width match makes text extractors treat every glyph as its
         * own word, which destroys the searchability this tool exists for.
         */
        const heightSize = Math.max(1, boxHeight * 0.82);
        const widthAtHeightSize = font.widthOfTextAtSize(text, heightSize);
        const fitted =
          widthAtHeightSize > 0 ? heightSize * (boxWidth / widthAtHeightSize) : heightSize;

        // Stay near the visual height so line spacing does not go haywire.
        const size = Math.min(heightSize * 1.4, Math.max(heightSize * 0.6, fitted));

        page.drawText(text, {
          x,
          y,
          size,
          font,
          // Mode 3 = "invisible": present in the text layer, never painted.
          renderMode: 3,
          rotate: degrees(0),
        });
        wordsFound += 1;
      }
    }

    const bytes = await savePdf(out);
    const file = await writeOutput(ctx.taskId, `${baseName}-ocr.pdf`, bytes);

    return {
      outputs: [{ name: file.name, size: file.size }],
      stats: { pages: total, words: wordsFound, language: langKey },
    };
  } finally {
    await worker.terminate();
  }
}

/** Tesseract's word list moved under blocks in v6; support both shapes. */
function collectWords(result: unknown): OcrWord[] {
  const root = result as {
    words?: OcrWord[];
    blocks?: {
      paragraphs?: { lines?: { words?: OcrWord[] }[] }[];
    }[];
  };

  if (Array.isArray(root.words) && root.words.length > 0) {
    return normalize(root.words);
  }

  const words: OcrWord[] = [];
  for (const block of root.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) words.push(word);
      }
    }
  }
  return normalize(words);
}

function normalize(words: (OcrWord & { bbox?: OcrWord })[]): OcrWord[] {
  return words
    .map((word) => {
      const box = word.bbox ?? word;
      return {
        text: word.text ?? "",
        x0: box.x0,
        y0: box.y0,
        x1: box.x1,
        y1: box.y1,
        confidence: word.confidence ?? 0,
      };
    })
    .filter((w) => Number.isFinite(w.x0) && Number.isFinite(w.y1));
}
