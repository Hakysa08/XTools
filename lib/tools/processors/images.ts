import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createPdf, savePdf } from "@/lib/pdf/document";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

/** Points, at 72 dpi. */
const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
};

const MARGINS: Record<string, number> = { none: 0, small: 18, big: 48 };

export async function jpgToPdf(ctx: ProcessContext): Promise<ProcessResult> {
  const o = ctx.options;
  const sizeKey = String(o.pageSize ?? "a4");
  const orientation = String(o.orientation ?? "portrait");
  const margin = MARGINS[String(o.margin ?? "small")] ?? 18;
  const fitMode = String(o.fit ?? "fit");
  const separate = o.separate === true;

  const buildDoc = async (files: typeof ctx.inputs) => {
    const doc = await createPdf();

    for (const input of files) {
      const raw = await readFile(input.path);

      // Normalise everything to PNG/JPEG: pdf-lib only embeds those two, and this
      // also applies EXIF rotation so photos are not sideways.
      const image = sharp(raw, { failOn: "none" }).rotate();
      const meta = await image.metadata();

      // Transparency has to survive, so alpha images become PNG; everything else
      // becomes JPEG, which keeps the resulting PDF much smaller.
      const keepAlpha = meta.hasAlpha === true;

      const normalized = keepAlpha
        ? await image.png({ compressionLevel: 9 }).toBuffer()
        : await image.flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();

      const embedded = keepAlpha
        ? await doc.embedPng(normalized)
        : await doc.embedJpg(normalized);
      const imgW = embedded.width;
      const imgH = embedded.height;

      let pageW: number;
      let pageH: number;

      if (sizeKey === "fit") {
        // Page takes the image's own proportions.
        pageW = imgW + margin * 2;
        pageH = imgH + margin * 2;
      } else {
        const [w, h] = PAGE_SIZES[sizeKey] ?? PAGE_SIZES.a4;
        const landscape =
          orientation === "landscape" || (orientation === "auto" && imgW > imgH);
        pageW = landscape ? h : w;
        pageH = landscape ? w : h;
      }

      const page = doc.addPage([pageW, pageH]);
      const boxW = Math.max(1, pageW - margin * 2);
      const boxH = Math.max(1, pageH - margin * 2);

      // "fit" letterboxes inside the margin box; "fill" covers it and crops.
      const scale =
        fitMode === "fill"
          ? Math.max(boxW / imgW, boxH / imgH)
          : Math.min(boxW / imgW, boxH / imgH);

      const drawW = imgW * scale;
      const drawH = imgH * scale;

      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    return doc;
  };

  if (separate) {
    const outputs: { name: string; size: number }[] = [];
    for (const input of ctx.inputs) {
      const doc = await buildDoc([input]);
      const bytes = await savePdf(doc);
      const baseName = stripExtension(path.basename(input.name));
      const file = await writeOutput(ctx.taskId, `${baseName}.pdf`, bytes);
      outputs.push({ name: file.name, size: file.size });
    }
    return { outputs, stats: { images: ctx.inputs.length } };
  }

  const doc = await buildDoc(ctx.inputs);
  const bytes = await savePdf(doc);
  const name = ctx.inputs.length === 1 ? `${stripExtension(path.basename(ctx.inputs[0].name))}.pdf` : "images.pdf";
  const file = await writeOutput(ctx.taskId, name, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { images: ctx.inputs.length, pages: doc.getPageCount() },
  };
}
