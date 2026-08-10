import "server-only";
import type { Processor } from "./types";

/**
 * Processors are loaded on demand: a merge request should not pull in Puppeteer
 * or Tesseract just because they exist elsewhere in the map.
 */
const loaders: Record<string, () => Promise<Processor>> = {
  merge: async () => (await import("./merge")).merge,

  split: async () => (await import("./organize")).split,
  removePages: async () => (await import("./organize")).removePages,
  extractPages: async () => (await import("./organize")).extractPages,
  organize: async () => (await import("./organize")).organize,
  rotate: async () => (await import("./organize")).rotate,

  pageNumbers: async () => (await import("./edit")).pageNumbers,
  watermark: async () => (await import("./edit")).watermark,
  crop: async () => (await import("./edit")).crop,

  jpgToPdf: async () => (await import("./images")).jpgToPdf,

  compress: async () => (await import("./optimize")).compress,
  repair: async () => (await import("./optimize")).repair,
  pdfToPdfA: async () => (await import("./optimize")).pdfToPdfA,
  pdfToJpg: async () => (await import("./optimize")).pdfToJpg,
  ocr: async () => (await import("./ocr")).ocr,

  officeToPdf: async () => (await import("./convert")).officeToPdfProcessor,
  htmlToPdf: async () => (await import("./convert")).htmlToPdfProcessor,
  pdfToWord: async () => (await import("./convert")).pdfToWord,
  pdfToExcel: async () => (await import("./convert")).pdfToExcel,
  pdfToPowerpoint: async () => (await import("./convert")).pdfToPowerpoint,

  protect: async () => (await import("./security")).protect,
  unlock: async () => (await import("./security")).unlock,
  sign: async () => (await import("./security")).sign,
  redact: async () => (await import("./security")).redact,
  compare: async () => (await import("./security")).compare,

  editPdf: async () => (await import("./annotate")).editPdf,
  pdfForms: async () => (await import("./annotate")).pdfForms,
};

export async function getProcessor(key: string): Promise<Processor | null> {
  const loader = loaders[key];
  if (!loader) return null;
  return loader();
}

export function hasProcessor(key: string): boolean {
  return key in loaders;
}
