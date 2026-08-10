import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";

import { PdfError, createPdf, loadPdf, savePdf } from "@/lib/pdf/document";
import { embedStandardFont, hexToRgb, toWinAnsi } from "@/lib/pdf/fonts";
import { parsePageRange } from "@/lib/pdf/pages";
import { extractTextItems, renderPages, type PageText } from "@/lib/pdf/render";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

// -------------------------------------------------------------- protect

export async function protect(ctx: ProcessContext): Promise<ProcessResult> {
  const password = String(ctx.options.password ?? "");
  if (password.length < 4) {
    throw new PdfError("Choose a password of at least 4 characters", "failed");
  }

  const ownerPassword = String(ctx.options.ownerPassword ?? "") || undefined;
  const outputs: { name: string; size: number }[] = [];

  for (const input of ctx.inputs) {
    const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });

    doc.encrypt({
      userPassword: password,
      ownerPassword: ownerPassword ?? password,
      permissions: {
        printing: ctx.options.allowPrinting === false ? undefined : "highResolution",
        copying: ctx.options.allowCopying !== false,
        modifying: ctx.options.allowModifying === true,
        annotating: ctx.options.allowAnnotating === true,
        fillingForms: ctx.options.allowForms !== false,
        contentAccessibility: true,
        documentAssembly: ctx.options.allowModifying === true,
      },
    });

    const bytes = await savePdf(doc);
    const baseName = stripExtension(path.basename(input.name));
    const file = await writeOutput(ctx.taskId, `${baseName}-protected.pdf`, bytes);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { files: ctx.inputs.length, encryption: "AES-256" } };
}

// --------------------------------------------------------------- unlock

export async function unlock(ctx: ProcessContext): Promise<ProcessResult> {
  const password = String(ctx.options.password ?? "");
  const outputs: { name: string; size: number }[] = [];

  for (const input of ctx.inputs) {
    const data = await readFile(input.path);

    // Try the supplied password first; some files are "encrypted" with an empty
    // user password and open without one.
    let doc;
    try {
      doc = await loadPdf(data, { password: password || undefined });
    } catch (err) {
      if (err instanceof PdfError && err.code === "encrypted" && !password) {
        throw new PdfError("This PDF needs a password to unlock", "encrypted");
      }
      throw err;
    }

    /*
     * Re-saving a document that was opened with its password keeps the
     * encryption dictionary, and so does deleting `trailerInfo.Encrypt` — the
     * output still refuses to open without the password. Copying the pages into
     * a fresh document is what actually produces a decrypted file.
     *
     * The cost is that annotations and form fields do not survive the copy, so
     * the document metadata is carried over explicitly.
     */
    const out = await createPdf();
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const page of pages) out.addPage(page);

    copyMetadata(doc, out);

    const bytes = await savePdf(out);
    const baseName = stripExtension(path.basename(input.name));
    const file = await writeOutput(ctx.taskId, `${baseName}-unlocked.pdf`, bytes);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { files: ctx.inputs.length } };
}

/** Best-effort carry-over of the document information dictionary. */
function copyMetadata(from: Awaited<ReturnType<typeof loadPdf>>, to: Awaited<ReturnType<typeof createPdf>>) {
  try {
    const title = from.getTitle();
    const author = from.getAuthor();
    const subject = from.getSubject();
    const keywords = from.getKeywords();

    if (title) to.setTitle(title);
    if (author) to.setAuthor(author);
    if (subject) to.setSubject(subject);
    if (keywords) to.setKeywords(keywords.split(/[,;]\s*/));
  } catch {
    // Some documents carry malformed info dictionaries; not worth failing over.
  }
}

// ----------------------------------------------------------------- sign

export interface SignaturePlacement {
  page: number;
  /** Fractions of the page, measured from the top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function sign(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const doc = await loadPdf(await readFile(input.path), { ignoreEncryption: true });
  const total = doc.getPageCount();

  const o = ctx.options;
  const mode = String(o.mode ?? "draw");

  /*
   * Two ways in: an explicit per-page list (from the visual editor), or a single
   * rectangle plus a page range, which is expanded here because this is the
   * first point that knows how many pages the document actually has.
   */
  let placements = (Array.isArray(o.placements) ? o.placements : []) as SignaturePlacement[];

  if (placements.length === 0 && o.placement && typeof o.placement === "object") {
    const rect = o.placement as Omit<SignaturePlacement, "page">;
    const targets = parsePageRange(String(o.pages ?? "last"), total);
    placements = targets.map((page) => ({ page, ...rect }));
  }

  if (placements.length === 0) {
    throw new Error("Place your signature on the document first");
  }

  // A drawn or uploaded signature arrives as a PNG data URL or a second file.
  let signatureImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;

  if (mode === "draw" || mode === "image") {
    const dataUrl = String(o.signatureImage ?? "");
    if (dataUrl.startsWith("data:image/")) {
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = Buffer.from(base64, "base64");
      signatureImage = dataUrl.includes("image/jpeg")
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(bytes);
    } else if (ctx.inputs[1]) {
      const bytes = await readFile(ctx.inputs[1].path);
      const ext = path.extname(ctx.inputs[1].name).toLowerCase();
      signatureImage =
        ext === ".jpg" || ext === ".jpeg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    } else {
      throw new Error("Draw or upload a signature first");
    }
  }

  const typedText = toWinAnsi(String(o.text ?? ""));
  const font = await doc.embedFont(StandardFonts.HelveticaOblique);
  const color = hexToRgb(String(o.color ?? "#111827"));

  let placed = 0;

  for (const spot of placements) {
    if (spot.page < 1 || spot.page > total) continue;
    const page = doc.getPage(spot.page - 1);
    const { width: pw, height: ph } = page.getSize();

    const boxW = Math.max(1, spot.width * pw);
    const boxH = Math.max(1, spot.height * ph);
    const x = spot.x * pw;
    // Placements come in top-down; PDF space is bottom-up.
    const y = ph - spot.y * ph - boxH;

    if (signatureImage) {
      // Preserve the signature's aspect ratio inside the placed box.
      const ratio = signatureImage.width / signatureImage.height;
      let w = boxW;
      let h = boxW / ratio;
      if (h > boxH) {
        h = boxH;
        w = boxH * ratio;
      }
      page.drawImage(signatureImage, { x, y: y + (boxH - h) / 2, width: w, height: h });
    } else {
      const size = Math.max(8, boxH * 0.7);
      page.drawText(typedText || "Signature", {
        x,
        y: y + boxH * 0.25,
        size,
        font,
        color: rgb(color.r, color.g, color.b),
      });
    }

    if (o.stampDate === true) {
      const stampFont = await embedStandardFont(doc, "helvetica");
      const stamp = toWinAnsi(new Date().toLocaleDateString("id-ID"));
      page.drawText(stamp, {
        x,
        y: y - 12,
        size: 8,
        font: stampFont,
        color: rgb(0.42, 0.45, 0.5),
      });
    }

    placed += 1;
  }

  if (placed === 0) throw new Error("No signature could be placed on those pages");

  const bytes = await savePdf(doc);
  const baseName = stripExtension(path.basename(input.name));
  const file = await writeOutput(ctx.taskId, `${baseName}-signed.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, signatures: placed },
  };
}

// --------------------------------------------------------------- redact

export interface RedactionBox {
  page: number;
  /** Fractions of the page, measured from the top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Genuine redaction. Drawing a black rectangle over text leaves the text in the
 * file, where anyone can select or extract it — so the affected pages are
 * rasterised, which discards the underlying text and image data entirely, and
 * the blackout is burned into the pixels.
 */
export async function redact(ctx: ProcessContext): Promise<ProcessResult> {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const baseName = stripExtension(path.basename(input.name));

  const source = await loadPdf(data, { ignoreEncryption: true });
  const total = source.getPageCount();

  const boxes = (Array.isArray(ctx.options.boxes) ? ctx.options.boxes : []) as RedactionBox[];
  const searchTerms = (
    Array.isArray(ctx.options.searchTerms) ? ctx.options.searchTerms : []
  ) as string[];

  const allBoxes: RedactionBox[] = [...boxes];

  // "Find and redact": locate each term's glyphs and cover them.
  if (searchTerms.length > 0) {
    const pages = await extractTextItems({ data });
    for (const page of pages) {
      for (const item of page.items) {
        const haystack = item.text.toLowerCase();
        const hit = searchTerms.some(
          (term) => term.trim() && haystack.includes(term.trim().toLowerCase()),
        );
        if (!hit) continue;

        const pad = item.height * 0.25;
        allBoxes.push({
          page: page.page,
          x: Math.max(0, (item.x - pad) / page.width),
          // Convert the PDF baseline to a top-down fraction.
          y: Math.max(0, (page.height - item.y - item.height - pad) / page.height),
          width: Math.min(1, (item.width + pad * 2) / page.width),
          height: Math.min(1, (item.height + pad * 2) / page.height),
        });
      }
    }
  }

  if (allBoxes.length === 0) {
    throw new Error("Select an area to redact, or enter a word to find and redact");
  }

  const affected = [...new Set(allBoxes.map((b) => b.page))]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const rendered = await renderPages({ data }, affected, {
    dpi: Number(ctx.options.dpi ?? 150),
    format: "png",
    background: "#ffffff",
  });

  const out = await createPdf();
  const rasterByPage = new Map<number, (typeof rendered)[number]>();
  affected.forEach((pageNo, i) => rasterByPage.set(pageNo, rendered[i]));

  // Untouched pages are copied across as-is, keeping their text intact.
  const untouched = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => !rasterByPage.has(p),
  );
  const copied = await out.copyPages(
    source,
    untouched.map((p) => p - 1),
  );
  const copiedByPage = new Map<number, (typeof copied)[number]>();
  untouched.forEach((pageNo, i) => copiedByPage.set(pageNo, copied[i]));

  for (let pageNo = 1; pageNo <= total; pageNo += 1) {
    const raster = rasterByPage.get(pageNo);

    if (!raster) {
      out.addPage(copiedByPage.get(pageNo)!);
      continue;
    }

    const { width, height } = source.getPage(pageNo - 1).getSize();
    const image = await out.embedPng(raster.buffer);
    const page = out.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    for (const box of allBoxes.filter((b) => b.page === pageNo)) {
      page.drawRectangle({
        x: box.x * width,
        y: height - box.y * height - box.height * height,
        width: box.width * width,
        height: box.height * height,
        color: rgb(0, 0, 0),
      });
    }
  }

  const bytes = await savePdf(out);
  const file = await writeOutput(ctx.taskId, `${baseName}-redacted.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: total, redactions: allBoxes.length, pagesRasterized: affected.length },
  };
}

// -------------------------------------------------------------- compare

export async function compare(ctx: ProcessContext): Promise<ProcessResult> {
  if (ctx.inputs.length < 2) throw new Error("Select two PDF files to compare");

  const [a, b] = ctx.inputs;
  const dataA = await readFile(a.path);
  const dataB = await readFile(b.path);

  const [pagesA, pagesB] = await Promise.all([
    extractTextItems({ data: dataA }),
    extractTextItems({ data: dataB }),
  ]);

  const { diffWords } = await import("diff");

  const doc = await createPdf();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let added = 0;
  let removed = 0;
  let changedPages = 0;

  const maxPages = Math.max(pagesA.length, pagesB.length);

  for (let i = 0; i < maxPages; i += 1) {
    const textA = pageToText(pagesA[i]);
    const textB = pageToText(pagesB[i]);
    if (textA === textB) continue;

    changedPages += 1;
    const parts = diffWords(textA, textB);

    const page = doc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 48;
    let y = height - margin;

    page.drawText(toWinAnsi(`Halaman ${i + 1}`), {
      x: margin,
      y,
      size: 15,
      font: bold,
      color: rgb(0.12, 0.16, 0.25),
    });
    y -= 26;

    for (const part of parts) {
      if (!part.value.trim()) continue;
      if (part.added) added += 1;
      if (part.removed) removed += 1;

      const color = part.added
        ? rgb(0.05, 0.5, 0.24)
        : part.removed
          ? rgb(0.72, 0.11, 0.24)
          : rgb(0.35, 0.39, 0.46);
      const prefix = part.added ? "+ " : part.removed ? "- " : "  ";

      for (const line of wrapText(toWinAnsi(prefix + part.value.trim()), font, 9.5, width - margin * 2)) {
        if (y < margin) break;
        page.drawText(line, { x: margin, y, size: 9.5, font, color });
        y -= 13;
      }
    }
  }

  if (changedPages === 0) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText("Tidak ada perbedaan teks / No text differences found", {
      x: 48,
      y: 780,
      size: 13,
      font: bold,
      color: rgb(0.05, 0.5, 0.24),
    });
  }

  const bytes = await savePdf(doc);
  const file = await writeOutput(ctx.taskId, "comparison-report.pdf", bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: {
      pagesA: pagesA.length,
      pagesB: pagesB.length,
      changedPages,
      added,
      removed,
    },
  };
}

function pageToText(page: PageText | undefined): string {
  if (!page) return "";
  return page.items
    .map((i) => i.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Greedy word wrap against the embedded font's real metrics. */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 400);
}
