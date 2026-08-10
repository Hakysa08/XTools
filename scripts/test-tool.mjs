/**
 * Drives a tool through the real HTTP pipeline and inspects the produced file.
 *   node scripts/test-tool.mjs <tool-slug> [options-json] -- <sample files...>
 *
 * Example:
 *   node scripts/test-tool.mjs merge-pdf {} -- doc-3p.pdf doc-1p.pdf
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "@cantoo/pdf-lib";

const BASE = process.env.XTOOLS_BASE ?? "http://localhost:3000";
const SAMPLES = path.join(process.cwd(), "samples");
const OUT = path.join(process.cwd(), "storage", "test-output");

const argv = process.argv.slice(2);
const dashdash = argv.indexOf("--");
const head = dashdash === -1 ? argv : argv.slice(0, dashdash);
const fileArgs = dashdash === -1 ? [] : argv.slice(dashdash + 1);

const tool = head[0];
const options = head[1] ? JSON.parse(head[1]) : {};

if (!tool || fileArgs.length === 0) {
  console.error("usage: node scripts/test-tool.mjs <tool> [optionsJson] -- <files...>");
  process.exit(1);
}

const ok = (label, pass, detail = "") =>
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

async function main() {
  console.log(`\n=== ${tool} ===`);
  console.log(`  files: ${fileArgs.join(", ")}`);
  if (Object.keys(options).length) console.log(`  options: ${JSON.stringify(options)}`);

  // 1. create task
  const createRes = await fetch(`${BASE}/api/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool }),
  });
  if (!createRes.ok) {
    console.error("  create failed:", createRes.status, await createRes.text());
    process.exit(1);
  }
  const { taskId } = await createRes.json();
  ok("create task", true, taskId.slice(0, 8));

  // 2. upload
  const form = new FormData();
  const inputSizes = [];
  for (const name of fileArgs) {
    const buf = await readFile(path.join(SAMPLES, name));
    inputSizes.push(buf.length);
    form.append("files", new Blob([buf]), name);
  }
  const upRes = await fetch(`${BASE}/api/task/${taskId}/upload`, { method: "POST", body: form });
  const upBody = await upRes.json();
  if (!upRes.ok) {
    console.error("  upload failed:", upRes.status, JSON.stringify(upBody));
    process.exit(1);
  }
  ok("upload", true, `${upBody.files.length} file(s)`);

  // 3. process
  const procRes = await fetch(`${BASE}/api/task/${taskId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: upBody.files.map((f) => f.name), options }),
  });
  const procBody = await procRes.json();
  if (!procRes.ok) {
    console.error("  process failed:", procRes.status, JSON.stringify(procBody, null, 2));
    process.exit(1);
  }
  ok("process", true, `${procBody.outputs.length} output(s)`);
  if (procBody.stats && Object.keys(procBody.stats).length) {
    console.log(`  stats: ${JSON.stringify(procBody.stats)}`);
  }

  // 4. download
  const dlRes = await fetch(`${BASE}/api/task/${taskId}/download`);
  if (!dlRes.ok) {
    console.error("  download failed:", dlRes.status);
    process.exit(1);
  }
  const bytes = Buffer.from(await dlRes.arrayBuffer());
  const disposition = dlRes.headers.get("content-disposition") ?? "";
  const type = dlRes.headers.get("content-type") ?? "";
  ok("download", bytes.length > 0, `${bytes.length} bytes, ${type}`);

  await mkdir(OUT, { recursive: true });
  const outName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${tool}.bin`;
  const savedAt = path.join(OUT, outName);
  await writeFile(savedAt, bytes);

  // 5. inspect the artefact itself
  if (outName.toLowerCase().endsWith(".pdf")) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
    const pages = doc.getPageCount();
    ok("output is a readable PDF", true, `${pages} page(s)`);
    const sizes = doc.getPages().map((p) => {
      const { width, height } = p.getSize();
      return `${Math.round(width)}x${Math.round(height)}`;
    });
    console.log(`  page sizes: ${[...new Set(sizes)].join(", ")}`);
  } else if (bytes.subarray(0, 2).toString() === "PK") {
    ok("output is a ZIP archive", true);
  }

  console.log(`  saved: ${savedAt}`);
  return { taskId, procBody, bytes, outName };
}

main().catch((err) => {
  console.error("  ERROR:", err.message);
  process.exit(1);
});
