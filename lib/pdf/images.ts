import "server-only";
import sharp from "sharp";
import {
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFNumber,
  type PDFDocument,
} from "@cantoo/pdf-lib";

export interface RecompressSettings {
  /** Longest edge in pixels an embedded image may keep. */
  maxPixels: number;
  jpegQuality: number;
}

export interface RecompressReport {
  imagesFound: number;
  imagesRewritten: number;
  bytesBefore: number;
  bytesAfter: number;
}

/**
 * Re-encodes the bitmap images embedded in a PDF, in place.
 *
 * This is the quality-preserving half of the Compress tool: text and vector
 * artwork are untouched, so the result stays selectable and sharp, while the
 * photos — which is where the bytes actually are — get downsampled and
 * re-encoded as JPEG.
 *
 * Images with transparency, unusual colour spaces or exotic filters are skipped
 * rather than guessed at; getting those wrong would corrupt the page.
 */
export async function recompressEmbeddedImages(
  doc: PDFDocument,
  settings: RecompressSettings,
): Promise<RecompressReport> {
  const report: RecompressReport = {
    imagesFound: 0,
    imagesRewritten: 0,
    bytesBefore: 0,
    bytesAfter: 0,
  };

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;

    const dict = obj.dict;
    if (!(dict instanceof PDFDict)) continue;
    if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;

    report.imagesFound += 1;

    // Soft masks and stencil masks carry alpha that JPEG cannot represent.
    if (dict.has(PDFName.of("SMask")) || dict.has(PDFName.of("Mask"))) continue;
    if (dict.get(PDFName.of("ImageMask")) !== undefined) continue;

    const filter = dict.get(PDFName.of("Filter"));
    const filterName = filter instanceof PDFName ? filter.asString() : null;

    // Only handle plain JPEG streams; Flate bitmaps need colour-space handling
    // that is not worth the corruption risk here.
    if (filterName !== "/DCTDecode") continue;

    const original = obj.getContents();
    const widthObj = dict.get(PDFName.of("Width"));
    const heightObj = dict.get(PDFName.of("Height"));
    const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : 0;
    const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : 0;
    if (!width || !height) continue;

    try {
      const longest = Math.max(width, height);
      let pipeline = sharp(Buffer.from(original), { failOn: "none" });

      if (longest > settings.maxPixels) {
        const scale = settings.maxPixels / longest;
        pipeline = pipeline.resize({
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          fit: "fill",
        });
      }

      const rewritten = await pipeline
        .jpeg({ quality: settings.jpegQuality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      // Keep the original when re-encoding did not actually help.
      if (rewritten.data.byteLength >= original.byteLength) continue;

      const replacement = PDFRawStream.of(dict, rewritten.data);
      replacement.dict.set(PDFName.of("Width"), PDFNumber.of(rewritten.info.width));
      replacement.dict.set(PDFName.of("Height"), PDFNumber.of(rewritten.info.height));
      replacement.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
      replacement.dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
      replacement.dict.set(
        PDFName.of("ColorSpace"),
        PDFName.of(rewritten.info.channels === 1 ? "DeviceGray" : "DeviceRGB"),
      );
      replacement.dict.set(PDFName.of("Length"), PDFNumber.of(rewritten.data.byteLength));
      // A re-encoded stream is no longer whatever it was decoded from.
      replacement.dict.delete(PDFName.of("DecodeParms"));

      doc.context.assign(ref, replacement);

      report.imagesRewritten += 1;
      report.bytesBefore += original.byteLength;
      report.bytesAfter += rewritten.data.byteLength;
    } catch {
      // Unreadable image: leave the original stream untouched.
    }
  }

  return report;
}
