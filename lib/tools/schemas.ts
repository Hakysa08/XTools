import { z } from "zod";

import type { ToolSlug } from "./registry";

const empty = z.object({});

/** A page-range string like "1-3, 7, 9-". Empty means every page. */
const pageSpec = z.string().max(400).optional();

const anchor = z
  .enum([
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ])
  .optional();

const fontChoice = z.enum(["helvetica", "times", "courier"]).optional();
const paperFormat = z.enum(["A4", "Letter", "Legal", "A3", "A5"]).optional();

const officeSchema = z.object({
  format: paperFormat,
  landscape: z.boolean().optional(),
});

/** A rectangle on a page, as fractions of the page with a top-left origin. */
const placementBox = z.object({
  page: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
const hexColor = z
  .string()
  .regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected a hex colour")
  .optional();

/**
 * Per-tool option schemas. The process route validates against these before a
 * processor runs, so processors can trust their options.
 */
export const TOOL_SCHEMAS: Partial<Record<ToolSlug, z.ZodType>> = {
  "merge-pdf": empty,

  "split-pdf": z.object({
    mode: z.enum(["ranges", "every", "all"]).optional(),
    pages: pageSpec,
    everyN: z.number().int().min(1).max(1000).optional(),
    merge: z.boolean().optional(),
  }),

  "remove-pages": z.object({ pages: pageSpec }),

  "extract-pages": z.object({
    pages: pageSpec,
    separate: z.boolean().optional(),
  }),

  "organize-pdf": z.object({
    pages: z
      .array(
        z.object({
          page: z.number().int().min(1),
          rotate: z.number().int().optional(),
        }),
      )
      .max(5000)
      .optional(),
  }),

  "rotate-pdf": z.object({
    rotation: z.union([z.literal(90), z.literal(180), z.literal(270), z.literal(-90)]).optional(),
    pages: pageSpec,
    perPage: z.record(z.string(), z.number().int()).optional(),
  }),

  "add-page-numbers": z.object({
    position: anchor,
    format: z.enum(["n", "n-of-N", "page-n-of-N"]).optional(),
    font: fontChoice,
    fontSize: z.number().min(6).max(72).optional(),
    bold: z.boolean().optional(),
    color: hexColor,
    margin: z.number().min(0).max(200).optional(),
    startNumber: z.number().int().min(0).max(100000).optional(),
    pages: pageSpec,
  }),

  "watermark-pdf": z.object({
    mode: z.enum(["text", "image"]).optional(),
    text: z.string().max(200).optional(),
    position: anchor,
    layer: z.enum(["over", "below"]).optional(),
    opacity: z.number().min(0.05).max(1).optional(),
    rotation: z.number().min(-180).max(180).optional(),
    tile: z.boolean().optional(),
    margin: z.number().min(0).max(300).optional(),
    font: fontChoice,
    fontSize: z.number().min(8).max(200).optional(),
    bold: z.boolean().optional(),
    color: hexColor,
    imageScale: z.number().min(0.05).max(1).optional(),
    pages: pageSpec,
  }),

  "crop-pdf": z.object({
    left: z.number().min(0).max(0.95).optional(),
    top: z.number().min(0).max(0.95).optional(),
    right: z.number().min(0).max(0.95).optional(),
    bottom: z.number().min(0).max(0.95).optional(),
    pages: pageSpec,
  }),

  "jpg-to-pdf": z.object({
    pageSize: z.enum(["a4", "letter", "legal", "a3", "a5", "fit"]).optional(),
    orientation: z.enum(["portrait", "landscape", "auto"]).optional(),
    margin: z.enum(["none", "small", "big"]).optional(),
    fit: z.enum(["fit", "fill"]).optional(),
    separate: z.boolean().optional(),
  }),

  "compress-pdf": z.object({
    level: z.enum(["low", "recommended", "extreme"]).optional(),
  }),

  "repair-pdf": empty,

  "pdf-to-pdfa": z.object({
    conformance: z.enum(["1B", "2B", "3B"]).optional(),
  }),

  "pdf-to-jpg": z.object({
    dpi: z.number().min(72).max(300).optional(),
    format: z.enum(["jpeg", "png"]).optional(),
    quality: z.number().min(30).max(100).optional(),
  }),

  "ocr-pdf": z.object({
    language: z.enum(["ind+eng", "ind", "eng"]).optional(),
    dpi: z.number().min(150).max(300).optional(),
    keepOriginal: z.boolean().optional(),
  }),

  // Office and HTML conversion. Missing entries here are not harmless: the
  // fallback schema strips unknown keys, so options would silently vanish.
  "word-to-pdf": officeSchema,
  "excel-to-pdf": officeSchema,
  "powerpoint-to-pdf": officeSchema,

  "html-to-pdf": z.object({
    url: z.string().max(2000).optional(),
    format: paperFormat,
    landscape: z.boolean().optional(),
    margin: z.string().max(12).optional(),
  }),

  "pdf-to-word": empty,
  "pdf-to-excel": empty,

  "pdf-to-powerpoint": z.object({
    dpi: z.number().min(72).max(300).optional(),
  }),

  // Security. A rectangle expressed as fractions of the page, top-left origin.
  "protect-pdf": z.object({
    password: z.string().min(4).max(200),
    ownerPassword: z.string().max(200).optional(),
    allowPrinting: z.boolean().optional(),
    allowCopying: z.boolean().optional(),
    allowModifying: z.boolean().optional(),
    allowAnnotating: z.boolean().optional(),
    allowForms: z.boolean().optional(),
  }),

  "unlock-pdf": z.object({
    password: z.string().max(200).optional(),
  }),

  "sign-pdf": z.object({
    mode: z.enum(["draw", "type", "image"]).optional(),
    signatureImage: z.string().max(4_000_000).optional(),
    text: z.string().max(120).optional(),
    color: hexColor,
    stampDate: z.boolean().optional(),
    /** Explicit per-page placements, as produced by the visual editor. */
    placements: z.array(placementBox).max(200).optional(),
    /** Single rectangle applied across `pages`; expanded server-side. */
    placement: placementBox.omit({ page: true }).optional(),
    pages: pageSpec,
    position: anchor,
    size: z.number().min(0.05).max(1).optional(),
  }),

  "redact-pdf": z.object({
    boxes: z.array(placementBox).max(500).optional(),
    searchTerms: z.array(z.string().max(120)).max(50).optional(),
    dpi: z.number().min(72).max(300).optional(),
  }),

  "compare-pdf": empty,

  "edit-pdf": z.object({
    annotations: z
      .array(
        z.object({
          type: z.enum(["text", "rect", "ellipse", "line", "freehand", "highlight", "image"]),
          page: z.number().int().min(1),
          x: z.number().min(-1).max(2),
          y: z.number().min(-1).max(2),
          width: z.number().min(0).max(2).optional(),
          height: z.number().min(0).max(2).optional(),
          points: z.array(z.object({ x: z.number(), y: z.number() })).max(5000).optional(),
          text: z.string().max(2000).optional(),
          fontSize: z.number().min(4).max(200).optional(),
          font: fontChoice,
          color: hexColor,
          fill: hexColor,
          opacity: z.number().min(0).max(1).optional(),
          strokeWidth: z.number().min(0.5).max(40).optional(),
          image: z.string().max(4_000_000).optional(),
        }),
      )
      .max(2000)
      .optional(),
  }),

  "pdf-forms": z.object({
    fields: z
      .array(
        z.object({
          type: z.enum(["text", "checkbox", "radio", "dropdown"]),
          name: z.string().max(120),
          page: z.number().int().min(1),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().min(0).max(1),
          height: z.number().min(0).max(1),
          value: z.string().max(500).optional(),
          options: z.array(z.string().max(200)).max(50).optional(),
          required: z.boolean().optional(),
        }),
      )
      .max(300)
      .optional(),
    values: z.record(z.string(), z.string().max(2000)).optional(),
  }),

  "scan-to-pdf": z.object({
    pageSize: z.enum(["a4", "letter", "legal", "a3", "a5", "fit"]).optional(),
    orientation: z.enum(["portrait", "landscape", "auto"]).optional(),
    margin: z.enum(["none", "small", "big"]).optional(),
    fit: z.enum(["fit", "fill"]).optional(),
  }),
};

export function getToolSchema(slug: string): z.ZodType {
  return TOOL_SCHEMAS[slug as ToolSlug] ?? empty;
}
