import "server-only";
import { PDFDocument, type PDFPage } from "@cantoo/pdf-lib";

/** Surfaced to the client with a translated message instead of a stack trace. */
export class PdfError extends Error {
  constructor(
    message: string,
    readonly code:
      | "encrypted"
      | "wrong-password"
      | "corrupt"
      | "empty"
      | "unsupported"
      | "too-large"
      | "failed",
  ) {
    super(message);
    this.name = "PdfError";
  }
}

export interface LoadPdfOptions {
  password?: string;
  /** Open a protected file without its password (fine for read-only work). */
  ignoreEncryption?: boolean;
}

/**
 * Loads a PDF and turns pdf-lib's assorted failure modes into typed errors the
 * API layer can translate.
 */
export async function loadPdf(data: Buffer | Uint8Array, opts: LoadPdfOptions = {}) {
  try {
    const doc = await PDFDocument.load(data, {
      password: opts.password,
      ignoreEncryption: opts.ignoreEncryption ?? false,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
    if (doc.getPageCount() === 0) {
      throw new PdfError("Document has no pages", "empty");
    }
    return doc;
  } catch (err) {
    if (err instanceof PdfError) throw err;
    const message = err instanceof Error ? err.message : String(err);

    if (/password/i.test(message)) {
      throw new PdfError(
        opts.password ? "Incorrect password" : "Document is password protected",
        opts.password ? "wrong-password" : "encrypted",
      );
    }
    if (/encrypt/i.test(message)) {
      throw new PdfError("Document is encrypted", "encrypted");
    }
    throw new PdfError(`Could not read PDF: ${message}`, "corrupt");
  }
}

export async function createPdf() {
  return PDFDocument.create();
}

/** Serialises a document, with object streams on for a smaller file. */
export async function savePdf(doc: PDFDocument): Promise<Buffer> {
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return Buffer.from(bytes);
}

/** Copies the given 1-based pages from `src` into `target`, preserving order. */
export async function copyPagesInto(
  target: PDFDocument,
  src: PDFDocument,
  pages1Based: number[],
): Promise<PDFPage[]> {
  const indices = pages1Based.map((p) => p - 1);
  const copied = await target.copyPages(src, indices);
  for (const page of copied) target.addPage(page);
  return copied;
}

/** Normalises pdf-lib's rotation to 0/90/180/270. */
export function normalizeRotation(deg: number): 0 | 90 | 180 | 270 {
  const value = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return value as 0 | 90 | 180 | 270;
}

export { PDFDocument };
