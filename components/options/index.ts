import type { ToolSlug } from "@/lib/tools/registry";

import {
  CompareNote,
  CompressOptions,
  CropOptions,
  ExtractPagesOptions,
  FromPdfNote,
  HtmlToPdfOptions,
  JpgToPdfOptions,
  OcrOptions,
  PageNumberOptions,
  PdfAOptions,
  PdfToJpgOptions,
  PdfToPowerpointOptions,
  ProtectOptions,
  RedactOptions,
  SignOptions,
  UnlockOptions,
  OfficeToPdfOptions,
  RemovePagesOptions,
  RotateOptions,
  SplitOptions,
  WatermarkOptions,
} from "./panels";
import type { OptionsPanel } from "./types";

/**
 * Option panels keyed by tool slug. Tools without an entry render no options
 * panel and submit an empty object.
 */
export const OPTIONS_PANELS: Partial<Record<ToolSlug, OptionsPanel>> = {
  "split-pdf": SplitOptions,
  "remove-pages": RemovePagesOptions,
  "extract-pages": ExtractPagesOptions,
  "rotate-pdf": RotateOptions,
  "add-page-numbers": PageNumberOptions,
  "watermark-pdf": WatermarkOptions,
  "crop-pdf": CropOptions,
  "jpg-to-pdf": JpgToPdfOptions,
  "compress-pdf": CompressOptions,
  "pdf-to-jpg": PdfToJpgOptions,
  "ocr-pdf": OcrOptions,
  "pdf-to-pdfa": PdfAOptions,
  "word-to-pdf": OfficeToPdfOptions,
  "excel-to-pdf": OfficeToPdfOptions,
  "powerpoint-to-pdf": OfficeToPdfOptions,
  "html-to-pdf": HtmlToPdfOptions,
  "pdf-to-word": FromPdfNote,
  "pdf-to-excel": FromPdfNote,
  "pdf-to-powerpoint": PdfToPowerpointOptions,
  "protect-pdf": ProtectOptions,
  "unlock-pdf": UnlockOptions,
  "redact-pdf": RedactOptions,
  "compare-pdf": CompareNote,
  "sign-pdf": SignOptions,
  "scan-to-pdf": JpgToPdfOptions,
};

export function getOptionsPanel(slug: string): OptionsPanel | undefined {
  return OPTIONS_PANELS[slug as ToolSlug];
}

/** Starting option values for each panel. */
export const DEFAULT_OPTIONS: Partial<Record<ToolSlug, Record<string, unknown>>> = {
  "split-pdf": { mode: "ranges", pages: "", everyN: 1, merge: false },
  "remove-pages": { pages: "" },
  "extract-pages": { pages: "", separate: false },
  "rotate-pdf": { rotation: 90, pages: "" },
  "add-page-numbers": {
    position: "bottom-center",
    format: "n",
    font: "helvetica",
    fontSize: 12,
    bold: false,
    color: "#000000",
    margin: 32,
    startNumber: 1,
    pages: "",
  },
  "watermark-pdf": {
    mode: "text",
    text: "XTools",
    position: "middle-center",
    layer: "over",
    opacity: 0.35,
    rotation: 45,
    tile: false,
    font: "helvetica",
    fontSize: 48,
    color: "#888888",
    imageScale: 0.4,
    pages: "",
  },
  "crop-pdf": { left: 0, top: 0, right: 0, bottom: 0, pages: "" },
  "jpg-to-pdf": { pageSize: "a4", orientation: "portrait", margin: "small", fit: "fit", separate: false },
  "compress-pdf": { level: "recommended" },
  "pdf-to-jpg": { dpi: 150, format: "jpeg", quality: 85 },
  "ocr-pdf": { language: "ind+eng", dpi: 200 },
  "pdf-to-pdfa": { conformance: "2B" },
  "word-to-pdf": { format: "A4", landscape: false },
  "excel-to-pdf": { format: "A4", landscape: true },
  "powerpoint-to-pdf": { format: "A4", landscape: true },
  "html-to-pdf": { url: "", format: "A4", margin: "12mm", landscape: false },
  "pdf-to-powerpoint": { dpi: 150 },
  "protect-pdf": { password: "", allowPrinting: true, allowCopying: true, allowModifying: false, allowAnnotating: false },
  "unlock-pdf": { password: "" },
  "redact-pdf": { searchTerms: [], dpi: 150 },
  "sign-pdf": {
    mode: "draw",
    position: "bottom-right",
    size: 0.22,
    pages: "last",
    stampDate: false,
    placement: { x: 0.73, y: 0.87, width: 0.22, height: 0.0836 },
  },
  "scan-to-pdf": { pageSize: "a4", orientation: "portrait", margin: "small", fit: "fit" },
};

export function getDefaultOptions(slug: string): Record<string, unknown> {
  return { ...(DEFAULT_OPTIONS[slug as ToolSlug] ?? {}) };
}
