import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { htmlStringToPdf, type HtmlToPdfOptions } from "./html";

const execFileAsync = promisify(execFile);

/*
 * Two conversion routes:
 *
 *   1. LibreOffice, when it happens to be installed — by far the best fidelity.
 *   2. A pure-JS fallback that parses the document and renders it through
 *      Chromium. Layout is approximate, but it works with no extra install.
 *
 * The caller does not need to know which one ran.
 */

const SOFFICE_CANDIDATES = [
  "soffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

let sofficeCache: string | null | undefined;

/** Locates LibreOffice once per process; `null` means it is not installed. */
export async function findSoffice(): Promise<string | null> {
  if (sofficeCache !== undefined) return sofficeCache;

  for (const candidate of SOFFICE_CANDIDATES) {
    if (candidate.includes(path.sep) || candidate.includes("/")) {
      // turbopackIgnore: these are absolute install paths outside the project,
      // not bundled assets. Without the marker the whole project gets traced
      // into the server bundle.
      if (existsSync(/* turbopackIgnore: true */ candidate)) {
        sofficeCache = candidate;
        return candidate;
      }
      continue;
    }
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 10_000 });
      sofficeCache = candidate;
      return candidate;
    } catch {
      // Not on PATH.
    }
  }

  sofficeCache = null;
  return null;
}

async function convertWithSoffice(
  soffice: string,
  input: Buffer,
  extension: string,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xtools-office-"));
  const outDir = path.join(dir, "out");
  await mkdir(outDir, { recursive: true });

  const inputPath = path.join(dir, `document${extension}`);
  await writeFile(inputPath, input);

  try {
    await execFileAsync(
      soffice,
      [
        "--headless",
        "--norestore",
        "--invisible",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        inputPath,
      ],
      { timeout: 180_000, windowsHide: true },
    );

    const produced = (await readdir(outDir)).find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!produced) throw new Error("LibreOffice produced no PDF");
    return await readFile(path.join(outDir, produced));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Page chrome shared by every fallback-rendered document. */
function wrapHtml(body: string, title: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 0; }
  body {
    font-family: "Segoe UI", Calibri, Carlito, Arial, sans-serif;
    font-size: 11pt; line-height: 1.5; color: #111; margin: 0;
  }
  h1 { font-size: 20pt; margin: 0 0 .5em; }
  h2 { font-size: 16pt; margin: 1.2em 0 .4em; }
  h3 { font-size: 13pt; margin: 1.1em 0 .3em; }
  p { margin: 0 0 .6em; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: 10pt; }
  th, td { border: 1px solid #c8ccd4; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef1f6; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  ul, ol { margin: 0 0 .6em 1.4em; padding: 0; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .sheet-name { font-size: 13pt; font-weight: 700; margin: 0 0 .5em; color: #2563eb; }
  .slide {
    page-break-after: always; border: 1px solid #dfe3ea; border-radius: 8px;
    padding: 24px; margin-bottom: 16px; min-height: 60vh;
  }
  .slide:last-child { page-break-after: auto; }
  .slide-title { font-size: 20pt; font-weight: 700; margin: 0 0 .6em; }
</style></head><body>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function wordToHtml(input: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { buffer: input },
    { convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read("base64");
        return { src: `data:${image.contentType};base64,${buffer}` };
      }) },
  );
  return result.value || "<p></p>";
}

async function spreadsheetToHtml(input: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(input, { type: "buffer" });

  const sections = workbook.SheetNames.map((name) => {
    const table = XLSX.utils.sheet_to_html(workbook.Sheets[name], { header: "", footer: "" });
    return `<section class="sheet"><p class="sheet-name">${escapeHtml(name)}</p>${table}</section>`;
  });

  return sections.join("\n") || "<p></p>";
}

/**
 * Minimal PPTX reader: pulls the text out of each slide's XML. Enough to produce
 * a readable document, but it is not a visual reproduction of the deck.
 */
async function presentationToHtml(input: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(input);

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const num = (s: string) => Number(/slide(\d+)\.xml$/.exec(s)?.[1] ?? 0);
      return num(a) - num(b);
    });

  const slides: string[] = [];

  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    // <a:t> holds the rendered text of every run in the slide.
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    );

    const texts = runs.map((r) => r.trim()).filter(Boolean);
    if (texts.length === 0) {
      slides.push(`<section class="slide"></section>`);
      continue;
    }

    const [title, ...rest] = texts;
    const body = rest.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    slides.push(
      `<section class="slide"><p class="slide-title">${escapeHtml(title)}</p>${body}</section>`,
    );
  }

  return slides.join("\n") || "<p></p>";
}

export type OfficeKind = "word" | "excel" | "powerpoint";

export function kindForExtension(extension: string): OfficeKind | null {
  const ext = extension.toLowerCase();
  if ([".doc", ".docx", ".odt", ".rtf"].includes(ext)) return "word";
  if ([".xls", ".xlsx", ".ods", ".csv"].includes(ext)) return "excel";
  if ([".ppt", ".pptx", ".odp"].includes(ext)) return "powerpoint";
  return null;
}

export interface OfficeConversion {
  pdf: Buffer;
  /** Which route produced the file, so the UI can be honest about fidelity. */
  engine: "libreoffice" | "fallback";
}

export async function officeToPdf(
  input: Buffer,
  extension: string,
  title: string,
  pdfOptions: HtmlToPdfOptions = {},
): Promise<OfficeConversion> {
  const soffice = await findSoffice();
  if (soffice) {
    try {
      return { pdf: await convertWithSoffice(soffice, input, extension), engine: "libreoffice" };
    } catch {
      // Fall through to the JS route rather than failing the job outright.
    }
  }

  const kind = kindForExtension(extension);
  if (!kind) throw new Error(`Unsupported document type: ${extension}`);

  const ext = extension.toLowerCase();

  let body: string;
  if (kind === "word") {
    if (ext === ".doc" || ext === ".rtf" || ext === ".odt") {
      throw new Error(
        `${ext.toUpperCase().slice(1)} files need LibreOffice installed to convert. Save the document as .docx and try again.`,
      );
    }
    body = await wordToHtml(input);
  } else if (kind === "excel") {
    body = await spreadsheetToHtml(input);
  } else {
    if (ext !== ".pptx") {
      throw new Error(
        `${ext.toUpperCase().slice(1)} files need LibreOffice installed to convert. Save the presentation as .pptx and try again.`,
      );
    }
    body = await presentationToHtml(input);
  }

  const html = wrapHtml(body, title);
  const pdf = await htmlStringToPdf(html, {
    format: pdfOptions.format ?? "A4",
    landscape: pdfOptions.landscape ?? kind === "powerpoint",
    margin: pdfOptions.margin ?? (kind === "powerpoint" ? "10mm" : "18mm"),
    printBackground: true,
  });

  return { pdf, engine: "fallback" };
}
