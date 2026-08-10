/**
 * Generates the sample files used to exercise the tools during development.
 *   node scripts/make-samples.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";

const OUT = path.join(process.cwd(), "samples");

const LOREM = [
  "XTools adalah kumpulan alat PDF gratis yang berjalan langsung di peramban.",
  "The quick brown fox jumps over the lazy dog while parsing a PDF stream.",
  "Dokumen ini dibuat otomatis untuk menguji fitur ekstraksi teks dan konversi.",
  "Compression, encryption and page manipulation are all exercised by these files.",
];

async function textPdf(name, pageCount, title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    page.drawText(title, { x: 56, y: height - 80, size: 24, font: bold, color: rgb(0.15, 0.23, 0.55) });
    page.drawText(`Halaman ${i + 1} dari ${pageCount}`, {
      x: 56,
      y: height - 108,
      size: 11,
      font,
      color: rgb(0.4, 0.44, 0.52),
    });

    page.drawLine({
      start: { x: 56, y: height - 122 },
      end: { x: width - 56, y: height - 122 },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.92),
    });

    let y = height - 158;
    for (let row = 0; row < 22; row++) {
      const line = `${row + 1}. ${LOREM[(i + row) % LOREM.length]}`;
      page.drawText(line, { x: 56, y, size: 10.5, font, color: rgb(0.1, 0.12, 0.18) });
      y -= 20;
      if (y < 80) break;
    }

    // A table-ish block so PDF-to-Excel has column structure to find.
    page.drawText("Item", { x: 56, y: 70, size: 10, font: bold });
    page.drawText("Qty", { x: 300, y: 70, size: 10, font: bold });
    page.drawText("Price", { x: 400, y: 70, size: 10, font: bold });
    page.drawText(`Widget ${i + 1}`, { x: 56, y: 52, size: 10, font });
    page.drawText(`${(i + 1) * 3}`, { x: 300, y: 52, size: 10, font });
    page.drawText(`${((i + 1) * 12.5).toFixed(2)}`, { x: 400, y: 52, size: 10, font });
  }

  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

/** A deliberately heavy PDF: large full-page JPEGs so compression has something to chew on. */
async function imagePdf(name, pages) {
  const doc = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    // Build a noisy RGB bitmap; noise resists compression, keeping the file big.
    const w = 700;
    const h = 900;
    const png = await makeNoisePng(w, h, i);
    const img = await doc.embedPng(png);
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

/** Minimal PNG encoder (no deps) so we can synthesise image-heavy PDFs. */
async function makeNoisePng(width, height, seed) {
  const zlib = await import("node:zlib");
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let s = seed * 9781 + 12345;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) >>> 16) & 0xff;

  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const band = Math.floor((y / height) * 4);
      raw[o++] = (rand() >> 1) + band * 30;
      raw[o++] = (rand() >> 2) + 60;
      raw[o++] = (rand() >> 1) + 40;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/**
 * A scan-like PDF: high-resolution JPEG photos embedded as DCTDecode streams,
 * which is what the compressor actually has to deal with in the real world.
 */
async function scanLikePdf(name, pages) {
  const sharp = (await import("sharp")).default;
  const doc = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    const w = 1700;
    const h = 2200;
    // Smooth, detailed content — compressible, unlike pure noise.
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 3;
        const wave = Math.sin(x / 90 + i) * Math.cos(y / 110 - i) * 60;
        const paper = 215 + Math.sin((x + y) / 400) * 20;
        const ink = (y % 140 < 6 && x > 180 && x < w - 180) ? -150 : 0;
        raw[o] = Math.max(0, Math.min(255, paper + wave + ink));
        raw[o + 1] = Math.max(0, Math.min(255, paper + wave * 0.7 + ink));
        raw[o + 2] = Math.max(0, Math.min(255, paper + wave * 0.4 + ink));
      }
    }
    const jpeg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer();

    const img = await doc.embedJpg(jpeg);
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

/**
 * A true "scanned document": text drawn into a bitmap, then embedded as an
 * image. There is no text layer, so OCR has real work to do.
 */
async function scannedTextPdf(name, pages) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const doc = await PDFDocument.create();

  const lines = [
    "LAPORAN KEUANGAN TAHUNAN",
    "",
    "Dokumen ini dipindai untuk menguji fitur OCR.",
    "The quick brown fox jumps over the lazy dog.",
    "Total pendapatan tahun ini naik sebesar 24 persen.",
    "Invoice number 4821 was paid on 12 March 2024.",
    "Terima kasih atas kepercayaan Anda kepada kami.",
  ];

  for (let i = 0; i < pages; i++) {
    const w = 1240; // ~150dpi A4
    const h = 1754;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#111111";
    ctx.font = "bold 46px Arial";
    ctx.fillText(lines[0], 90, 150);

    ctx.font = "30px Arial";
    let y = 260;
    for (const line of lines.slice(2)) {
      ctx.fillText(line, 90, y);
      y += 62;
    }
    ctx.font = "26px Arial";
    ctx.fillText(`Halaman ${i + 1} dari ${pages}`, 90, h - 90);

    const jpeg = canvas.toBuffer("image/jpeg", 92);
    const img = await doc.embedJpg(jpeg);
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

async function protectedPdf(name, password) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("Dokumen rahasia XTools", { x: 56, y: 760, size: 20, font });
  page.drawText(`Password: ${password}`, { x: 56, y: 730, size: 12, font });
  doc.encrypt({ userPassword: password, ownerPassword: `${password}-owner` });
  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

/** Rotated pages, for testing rotate/organize. */
async function rotatedPdf(name) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 4; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.setRotation(degrees(i * 90));
    page.drawText(`Rotasi ${i * 90} derajat`, { x: 60, y: 700, size: 28, font });
  }
  const bytes = await doc.save();
  await writeFile(path.join(OUT, name), bytes);
  return bytes.length;
}

async function images() {
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const png = await makeNoisePng(600, 400, i * 7);
    const name = `photo-${i}.png`;
    await writeFile(path.join(OUT, name), png);
    results.push([name, png.length]);
  }
  return results;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const made = [];
  made.push(["doc-10p.pdf", await textPdf("doc-10p.pdf", 10, "Laporan Tahunan XTools")]);
  made.push(["doc-3p.pdf", await textPdf("doc-3p.pdf", 3, "Ringkasan Singkat")]);
  made.push(["doc-1p.pdf", await textPdf("doc-1p.pdf", 1, "Satu Halaman")]);
  made.push(["heavy-images.pdf", await imagePdf("heavy-images.pdf", 4)]);
  made.push(["scan-like.pdf", await scanLikePdf("scan-like.pdf", 4)]);
  made.push(["scanned-text.pdf", await scannedTextPdf("scanned-text.pdf", 2)]);
  made.push(["protected.pdf", await protectedPdf("protected.pdf", "rahasia123")]);
  made.push(["rotated.pdf", await rotatedPdf("rotated.pdf")]);
  for (const entry of await images()) made.push(entry);

  // Beyond help: a header, a dangling catalog and noise. Repair should refuse.
  const broken = Buffer.concat([
    Buffer.from("%PDF-1.4\n"),
    Buffer.from("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"),
    Buffer.from("GARBAGE-TRAILING-BYTES-NO-XREF"),
  ]);
  await writeFile(path.join(OUT, "broken.pdf"), broken);
  made.push(["broken.pdf", broken.length]);

  /*
   * The realistic damage case: every object is intact but the cross-reference
   * table points to the wrong offsets and junk is appended. A good repair pass
   * should rebuild the index and recover all pages.
   */
  const healthy = await readFile(path.join(OUT, "doc-3p.pdf"));
  let text = healthy.toString("latin1");
  text = text.replace(/startxref\s*\n(\d+)/, (m, offset) => `startxref\n${Number(offset) + 984}`);
  text = text.replace(/^xref\n0 (\d+)/m, "xref\n0 $1");
  const damaged = Buffer.concat([
    Buffer.from(text, "latin1"),
    Buffer.from("\n%% appended junk that should be ignored\n"),
  ]);
  await writeFile(path.join(OUT, "damaged-xref.pdf"), damaged);
  made.push(["damaged-xref.pdf", damaged.length]);

  const fmt = (n) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`);
  console.log(`Samples written to ${OUT}\n`);
  for (const [name, size] of made) console.log(`  ${name.padEnd(22)} ${fmt(size)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
