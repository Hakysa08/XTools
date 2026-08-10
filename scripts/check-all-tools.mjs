/** Runs every live tool through the real pipeline and inspects its output. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "@cantoo/pdf-lib";

const BASE = process.env.XTOOLS_BASE ?? "http://localhost:3000";
const SAMPLES = path.join(process.cwd(), "samples");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retries once when the rate limiter asks us to back off. */
async function req(url, init) {
  let res = await fetch(url, init);
  if (res.status === 429) {
    const retry = (await res.clone().json().catch(() => ({}))).error?.retryAfter ?? 5;
    await sleep((retry + 1) * 1000);
    res = await fetch(url, init);
  }
  return res;
}

const CASES = [
  ["merge-pdf", {}, ["doc-3p.pdf", "doc-1p.pdf"], { pdfPages: 4 }],
  ["split-pdf", { mode: "every", everyN: 4 }, ["doc-10p.pdf"], { zip: true }],
  ["remove-pages", { pages: "2,4" }, ["doc-10p.pdf"], { pdfPages: 8 }],
  ["extract-pages", { pages: "1-3" }, ["doc-10p.pdf"], { pdfPages: 3 }],
  ["organize-pdf", { pages: [{ page: 2, rotate: 90 }, { page: 1, rotate: 0 }] }, ["doc-3p.pdf"], { pdfPages: 2 }],
  ["scan-to-pdf", {}, ["photo-1.png", "photo-2.png"], { pdfPages: 2 }],
  ["compress-pdf", { level: "recommended" }, ["scan-like.pdf"], { smaller: true }],
  ["repair-pdf", {}, ["damaged-xref.pdf"], { pdfPages: 3 }],
  ["ocr-pdf", { language: "eng", dpi: 150 }, ["scanned-text.pdf"], { pdfPages: 2 }],
  ["jpg-to-pdf", { pageSize: "a4" }, ["photo-1.png", "photo-2.png", "photo-3.png"], { pdfPages: 3 }],
  ["word-to-pdf", {}, ["doc-sample.docx"], { pdfMin: 1 }],
  ["excel-to-pdf", {}, ["sheet-sample.xlsx"], { pdfMin: 1 }],
  ["powerpoint-to-pdf", {}, ["deck-sample.pptx"], { pdfMin: 1 }],
  ["html-to-pdf", {}, ["page-sample.html"], { pdfMin: 1 }],
  ["pdf-to-word", {}, ["doc-3p.pdf"], { ext: ".docx" }],
  ["pdf-to-excel", {}, ["doc-3p.pdf"], { ext: ".xlsx" }],
  ["pdf-to-powerpoint", { dpi: 110 }, ["doc-3p.pdf"], { ext: ".pptx" }],
  ["pdf-to-jpg", { dpi: 100 }, ["doc-3p.pdf"], { zip: true }],
  ["pdf-to-pdfa", { conformance: "2B" }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["edit-pdf", { annotations: [{ type: "rect", page: 1, x: 0.1, y: 0.1, width: 0.3, height: 0.1, color: "#e11d48" }] }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["rotate-pdf", { rotation: 90 }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["add-page-numbers", { position: "bottom-center" }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["watermark-pdf", { mode: "text", text: "UJI", tile: true }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["crop-pdf", { left: 0.05, right: 0.05, top: 0.05, bottom: 0.05 }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["pdf-forms", { fields: [{ type: "text", name: "nama", page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.03 }] }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["sign-pdf", { mode: "type", text: "Rifky", pages: "last", placement: { x: 0.7, y: 0.85, width: 0.2, height: 0.07 } }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["protect-pdf", { password: "rahasia123" }, ["doc-3p.pdf"], { encrypted: true }],
  ["unlock-pdf", { password: "rahasia123" }, ["protected.pdf"], { decrypted: true }],
  ["redact-pdf", { searchTerms: ["XTools"] }, ["doc-3p.pdf"], { pdfPages: 3 }],
  ["compare-pdf", {}, ["doc-3p.pdf", "doc-1p.pdf"], { pdfMin: 1 }],
];

let pass = 0;
let fail = 0;

for (const [slug, options, files, expect] of CASES) {
  const label = slug.padEnd(20);
  try {
    const create = await req(`${BASE}/api/task`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: slug }),
    });
    const { taskId } = await create.json();

    const form = new FormData();
    let inputBytes = 0;
    for (const name of files) {
      const buf = await readFile(path.join(SAMPLES, name));
      inputBytes += buf.length;
      form.append("files", new Blob([buf]), name);
    }
    const up = await req(`${BASE}/api/task/${taskId}/upload`, { method: "POST", body: form });
    const upBody = await up.json();
    if (!up.ok) throw new Error(`upload ${up.status}: ${JSON.stringify(upBody.error)}`);

    const proc = await req(`${BASE}/api/task/${taskId}/process`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: upBody.files.map(f => f.name), options }),
    });
    const procBody = await proc.json();
    if (!proc.ok) throw new Error(`process ${proc.status}: ${procBody.error?.message}`);

    const dl = await req(`${BASE}/api/task/${taskId}/download`);
    if (!dl.ok) throw new Error(`download ${dl.status}`);
    const bytes = Buffer.from(await dl.arrayBuffer());
    const disp = dl.headers.get("content-disposition") ?? "";
    const outName = /filename="([^"]+)"/.exec(disp)?.[1] ?? "";

    const notes = [];

    if (expect.zip) {
      if (bytes.subarray(0, 2).toString() !== "PK") throw new Error("expected a ZIP");
      notes.push("zip");
    }
    if (expect.ext && !outName.toLowerCase().endsWith(expect.ext)) {
      throw new Error(`expected ${expect.ext}, got ${outName}`);
    }
    if (expect.pdfPages || expect.pdfMin) {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
      const n = doc.getPageCount();
      if (expect.pdfPages && n !== expect.pdfPages) throw new Error(`expected ${expect.pdfPages} pages, got ${n}`);
      if (expect.pdfMin && n < expect.pdfMin) throw new Error(`expected >=${expect.pdfMin} pages, got ${n}`);
      notes.push(`${n}p`);
    }
    if (expect.smaller) {
      if (bytes.length >= inputBytes) throw new Error(`not smaller: ${inputBytes} -> ${bytes.length}`);
      notes.push(`${Math.round((1 - bytes.length / inputBytes) * 100)}% smaller`);
    }
    if (expect.encrypted) {
      let refused = false;
      try { await PDFDocument.load(bytes); } catch { refused = true; }
      if (!refused) throw new Error("output was NOT encrypted");
      notes.push("encrypted");
    }
    if (expect.decrypted) {
      await PDFDocument.load(bytes); // throws if still encrypted
      notes.push("decrypted");
    }

    pass++;
    console.log(`  PASS  ${label} ${notes.join(", ")}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL  ${label} ${err.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed, of ${CASES.length} tools`);
process.exit(fail === 0 ? 0 : 1);
