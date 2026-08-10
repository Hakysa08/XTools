import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

import { PdfError } from "./document";

/**
 * pdf.js ships browser-first builds; the `legacy` bundle is the one that runs
 * under Node. It is imported lazily so tools that never rasterise a page do not
 * pay for loading it.
 */
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>;
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Root of the installed pdfjs-dist package, found on disk.
 *
 * `require.resolve` is not usable here: the bundler rewrites it and hands back
 * a synthetic "[externals]/..." path rather than a real filesystem location.
 */
let cachedPackageDir: string | null = null;

function packageDir(): string {
  if (cachedPackageDir) return cachedPackageDir;

  const candidates = [
    path.join(process.cwd(), "node_modules", "pdfjs-dist"),
    path.join(process.cwd(), "..", "node_modules", "pdfjs-dist"),
  ];

  for (const dir of candidates) {
    if (existsSync(path.join(dir, "package.json"))) {
      cachedPackageDir = dir;
      return dir;
    }
  }

  throw new Error("Could not locate the pdfjs-dist package on disk");
}

/*
 * The `turbopackIgnore` markers stop the bundler from treating these as static
 * asset references. Without them it traces the entire project into the server
 * bundle, which bloats deployments enormously.
 */
function assetUrl(...segments: string[]): string {
  // Trailing slash matters: pdf.js concatenates the file name onto this.
  return `${pathToFileURL(path.join(/* turbopackIgnore: true */ packageDir(), ...segments)).href}/`;
}

function fileUrl(...segments: string[]): string {
  return pathToFileURL(path.join(/* turbopackIgnore: true */ packageDir(), ...segments)).href;
}

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    /*
     * Imported by absolute file URL, with the bundler told to leave it alone.
     * A bare specifier gets bundled instead of externalised, and a bundled
     * pdf.js can no longer locate its own worker — it fails with
     * 'No "GlobalWorkerOptions.workerSrc" specified'.
     */
    const entry = fileUrl("legacy", "build", "pdf.mjs");
    pdfjsPromise = import(/* turbopackIgnore: true */ /* webpackIgnore: true */ entry).then(
      (mod: PdfjsModule) => {
        /*
         * Must happen before anything touches PDFWorker: pdf.js memoises its
         * fake-worker setup on first access, so a workerSrc that is still empty
         * at that moment caches a rejection for the lifetime of the process.
         */
        mod.GlobalWorkerOptions.workerSrc = fileUrl("legacy", "build", "pdf.worker.mjs");
        return mod;
      },
    );
  }
  return pdfjsPromise;
}

export interface PdfSource {
  data: Uint8Array;
  password?: string;
}

/**
 * Opens a document and guarantees the loading task is destroyed afterwards —
 * pdf.js leaks memory and timers otherwise.
 */
export async function withPdfDocument<T>(
  source: PdfSource,
  fn: (doc: PdfDoc) => Promise<T>,
): Promise<T> {
  const pdfjs = await getPdfjs();

  const task = pdfjs.getDocument({
    // pdf.js takes ownership of the buffer, so hand it a copy.
    data: new Uint8Array(source.data),
    password: source.password,
    useSystemFonts: true,
    standardFontDataUrl: assetUrl("standard_fonts"),
    cMapUrl: assetUrl("cmaps"),
    cMapPacked: true,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      throw new PdfError(
        source.password ? "Incorrect password" : "Document is password protected",
        source.password ? "wrong-password" : "encrypted",
      );
    }
    throw new PdfError(`Could not read PDF: ${message}`, "corrupt");
  }

  try {
    return await fn(doc);
  } finally {
    await task.destroy().catch(() => {});
  }
}

export interface RenderOptions {
  /** Target resolution; PDF user space is 72 dpi. */
  dpi?: number;
  /** Cap on the long edge in pixels, applied after dpi. */
  maxEdge?: number;
  format?: "png" | "jpeg";
  quality?: number;
  /** Composite onto white — needed for JPEG, which has no alpha. */
  background?: string;
}

export interface RenderedPage {
  buffer: Buffer;
  width: number;
  height: number;
}

/** Rasterises one 1-based page to an image buffer. */
export async function renderPage(
  source: PdfSource,
  pageNumber: number,
  options: RenderOptions = {},
): Promise<RenderedPage> {
  return withPdfDocument(source, async (doc) => renderFromDoc(doc, pageNumber, options));
}

/** Rasterises several pages while keeping the document open once. */
export async function renderPages(
  source: PdfSource,
  pageNumbers: number[],
  options: RenderOptions = {},
): Promise<RenderedPage[]> {
  return withPdfDocument(source, async (doc) => {
    const out: RenderedPage[] = [];
    for (const pageNumber of pageNumbers) {
      out.push(await renderFromDoc(doc, pageNumber, options));
    }
    return out;
  });
}

async function renderFromDoc(
  doc: PdfDoc,
  pageNumber: number,
  options: RenderOptions,
): Promise<RenderedPage> {
  const dpi = options.dpi ?? 150;
  const format = options.format ?? "png";
  const page = await doc.getPage(pageNumber);

  let scale = dpi / 72;
  const base = page.getViewport({ scale });

  // Keep very large pages from allocating an enormous canvas.
  const maxEdge = options.maxEdge ?? 4000;
  const longest = Math.max(base.width, base.height);
  if (longest > maxEdge) scale *= maxEdge / longest;

  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const background = options.background ?? (format === "jpeg" ? "#ffffff" : undefined);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  page.cleanup();

  const buffer =
    format === "jpeg"
      ? canvas.toBuffer("image/jpeg", options.quality ?? 85)
      : canvas.toBuffer("image/png");

  return { buffer, width, height };
}

export interface TextItem {
  text: string;
  /** Bottom-left origin, in PDF points. */
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

export interface PageText {
  page: number;
  width: number;
  height: number;
  items: TextItem[];
}

/**
 * Extracts text with positions. Used by PDF-to-Word/Excel, Compare and Redact,
 * so it keeps geometry rather than flattening to a plain string.
 */
export async function extractTextItems(source: PdfSource, pages?: number[]): Promise<PageText[]> {
  return withPdfDocument(source, async (doc) => {
    const targets = pages ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const out: PageText[] = [];

    for (const pageNumber of targets) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const items: TextItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const item = raw as {
          str: string;
          width: number;
          height: number;
          transform: number[];
          fontName: string;
        };
        if (!item.str) continue;
        items.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || Math.abs(item.transform[3]) || 10,
          fontName: item.fontName,
        });
      }

      page.cleanup();
      out.push({ page: pageNumber, width: viewport.width, height: viewport.height, items });
    }

    return out;
  });
}

/** Concatenates a page's items into reading-order lines. */
export function itemsToLines(pageText: PageText, yTolerance = 3): { y: number; text: string }[] {
  const rows = new Map<number, TextItem[]>();

  for (const item of pageText.items) {
    // Snap near-equal baselines together so one visual line stays one row.
    const key = [...rows.keys()].find((k) => Math.abs(k - item.y) <= yTolerance);
    const bucket = key === undefined ? [] : rows.get(key)!;
    if (key === undefined) rows.set(item.y, bucket);
    bucket.push(item);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // top of the page first
    .map(([y, items]) => ({
      y,
      text: items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((line) => line.text.length > 0);
}

export async function getPageCount(source: PdfSource): Promise<number> {
  return withPdfDocument(source, async (doc) => doc.numPages);
}
