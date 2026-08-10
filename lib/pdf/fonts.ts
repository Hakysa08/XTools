import "server-only";
import { StandardFonts, type PDFDocument, type PDFFont } from "@cantoo/pdf-lib";

export type FontChoice = "helvetica" | "times" | "courier";

const FONT_MAP: Record<FontChoice, { regular: StandardFonts; bold: StandardFonts }> = {
  helvetica: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  times: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
  courier: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold },
};

export async function embedStandardFont(
  doc: PDFDocument,
  choice: FontChoice = "helvetica",
  bold = false,
): Promise<PDFFont> {
  const entry = FONT_MAP[choice] ?? FONT_MAP.helvetica;
  return doc.embedFont(bold ? entry.bold : entry.regular);
}

/**
 * The 14 standard PDF fonts only cover WinAnsi. Text outside that range would
 * throw on draw, so replace unsupported characters rather than fail the job.
 */
export function toWinAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return { r: 0, g: 0, b: 0 };

  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = Number.parseInt(value, 16);
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

/** Nine-cell placement grid shared by the watermark and page-number tools. */
export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export function anchorPosition(
  anchor: Anchor,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
  margin: number,
): { x: number; y: number } {
  const [vertical, horizontal] = anchor.split("-") as [string, string];

  const x =
    horizontal === "left"
      ? margin
      : horizontal === "right"
        ? pageWidth - contentWidth - margin
        : (pageWidth - contentWidth) / 2;

  const y =
    vertical === "bottom"
      ? margin
      : vertical === "top"
        ? pageHeight - contentHeight - margin
        : (pageHeight - contentHeight) / 2;

  return { x, y };
}
