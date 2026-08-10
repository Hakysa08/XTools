import {
  Archive,
  Combine,
  Crop,
  Droplets,
  EyeOff,
  FileCode,
  FileMinus,
  FileOutput,
  FileText,
  FileType,
  GitCompare,
  Globe,
  Hash,
  Image as ImageIcon,
  Images,
  Languages,
  LayoutGrid,
  Lock,
  LockOpen,
  Minimize2,
  PenLine,
  PenTool,
  Presentation,
  RotateCw,
  ScanLine,
  ScanText,
  Scissors,
  Sheet,
  Sparkles,
  Table2,
  TextCursorInput,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type CategoryId = "organize" | "optimize" | "convert" | "edit" | "security" | "ai";

/**
 * Every tool slug, spelled out so the dictionaries can be checked for
 * completeness at compile time rather than blowing up at render time.
 */
export type ToolSlug =
  | "merge-pdf"
  | "split-pdf"
  | "remove-pages"
  | "extract-pages"
  | "organize-pdf"
  | "scan-to-pdf"
  | "compress-pdf"
  | "repair-pdf"
  | "ocr-pdf"
  | "jpg-to-pdf"
  | "word-to-pdf"
  | "powerpoint-to-pdf"
  | "excel-to-pdf"
  | "html-to-pdf"
  | "pdf-to-word"
  | "pdf-to-powerpoint"
  | "pdf-to-excel"
  | "pdf-to-jpg"
  | "pdf-to-pdfa"
  | "edit-pdf"
  | "rotate-pdf"
  | "add-page-numbers"
  | "watermark-pdf"
  | "crop-pdf"
  | "pdf-forms"
  | "sign-pdf"
  | "unlock-pdf"
  | "protect-pdf"
  | "redact-pdf"
  | "compare-pdf"
  | "summarize-pdf"
  | "translate-pdf"
  | "pdf-to-markdown";

/** Sub-column used by the Convert category in the mega menu. */
export type ConvertGroup = "to-pdf" | "from-pdf";

/** Interactive canvas a tool mounts in place of the plain file grid. */
export type EditorKind = "organize" | "crop" | "redact" | "sign" | "canvas" | "forms" | "scan";

export type OutputKind = "pdf" | "zip" | "docx" | "xlsx" | "pptx" | "md";

export interface AcceptSpec {
  /** MIME types passed to the file picker. */
  mime: string[];
  /** Lowercase extensions including the dot — the authoritative server-side check. */
  ext: string[];
}

export interface ToolDef {
  slug: ToolSlug;
  category: CategoryId;
  group?: ConvertGroup;
  icon: LucideIcon;
  accept: AcceptSpec;
  multiple: boolean;
  minFiles: number;
  maxFiles: number;
  /** Per-file size ceiling in bytes. */
  maxBytes: number;
  editor?: EditorKind;
  /** Key into the processor map in lib/tools/processors. */
  processor: string;
  status: "live" | "soon";
  output: OutputKind;
  badge?: "new";
}

export const CATEGORY_ORDER: CategoryId[] = [
  "organize",
  "optimize",
  "convert",
  "edit",
  "security",
  "ai",
];

const MB = 1024 * 1024;
const DEFAULT_MAX_BYTES = 100 * MB;

const PDF_ACCEPT: AcceptSpec = { mime: ["application/pdf"], ext: [".pdf"] };

const IMAGE_ACCEPT: AcceptSpec = {
  mime: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"],
  ext: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"],
};

const WORD_ACCEPT: AcceptSpec = {
  mime: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "application/rtf",
  ],
  ext: [".doc", ".docx", ".odt", ".rtf"],
};

const EXCEL_ACCEPT: AcceptSpec = {
  mime: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
  ],
  ext: [".xls", ".xlsx", ".ods", ".csv"],
};

const PPT_ACCEPT: AcceptSpec = {
  mime: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.presentation",
  ],
  ext: [".ppt", ".pptx", ".odp"],
};

const HTML_ACCEPT: AcceptSpec = {
  mime: ["text/html", "application/xhtml+xml"],
  ext: [".html", ".htm", ".xhtml"],
};

/** Shared defaults so each entry only states what makes it different. */
function tool(def: {
  slug: ToolSlug;
  category: CategoryId;
  icon: LucideIcon;
  processor: string;
  group?: ConvertGroup;
  accept?: AcceptSpec;
  multiple?: boolean;
  minFiles?: number;
  maxFiles?: number;
  maxBytes?: number;
  editor?: EditorKind;
  status?: "live" | "soon";
  output?: OutputKind;
  badge?: "new";
}): ToolDef {
  const multiple = def.multiple ?? false;
  return {
    slug: def.slug,
    category: def.category,
    group: def.group,
    icon: def.icon,
    accept: def.accept ?? PDF_ACCEPT,
    multiple,
    minFiles: def.minFiles ?? 1,
    maxFiles: def.maxFiles ?? (multiple ? 30 : 1),
    maxBytes: def.maxBytes ?? DEFAULT_MAX_BYTES,
    editor: def.editor,
    processor: def.processor,
    status: def.status ?? "live",
    output: def.output ?? "pdf",
    badge: def.badge,
  };
}

export const TOOLS: ToolDef[] = [
  // ---------- Organize ----------
  tool({
    slug: "merge-pdf",
    category: "organize",
    icon: Combine,
    processor: "merge",
    multiple: true,
    minFiles: 2,
  }),
  tool({
    slug: "split-pdf",
    category: "organize",
    icon: Scissors,
    processor: "split",
    output: "zip",
  }),
  tool({
    slug: "remove-pages",
    category: "organize",
    icon: FileMinus,
    processor: "removePages",
  }),
  tool({
    slug: "extract-pages",
    category: "organize",
    icon: FileOutput,
    processor: "extractPages",
  }),
  tool({
    slug: "organize-pdf",
    category: "organize",
    icon: LayoutGrid,
    processor: "organize",
    editor: "organize",
  }),
  tool({
    slug: "scan-to-pdf",
    category: "organize",
    icon: ScanLine,
    processor: "jpgToPdf",
    accept: IMAGE_ACCEPT,
    multiple: true,
    editor: "scan",
  }),

  // ---------- Optimize ----------
  tool({ slug: "compress-pdf", category: "optimize", icon: Minimize2, processor: "compress", multiple: true }),
  tool({ slug: "repair-pdf", category: "optimize", icon: Wrench, processor: "repair" }),
  tool({ slug: "ocr-pdf", category: "optimize", icon: ScanText, processor: "ocr", maxBytes: 50 * MB }),

  // ---------- Convert: to PDF ----------
  tool({
    slug: "jpg-to-pdf",
    category: "convert",
    group: "to-pdf",
    icon: ImageIcon,
    processor: "jpgToPdf",
    accept: IMAGE_ACCEPT,
    multiple: true,
    maxFiles: 60,
  }),
  tool({
    slug: "word-to-pdf",
    category: "convert",
    group: "to-pdf",
    icon: FileType,
    processor: "officeToPdf",
    accept: WORD_ACCEPT,
    multiple: true,
  }),
  tool({
    slug: "powerpoint-to-pdf",
    category: "convert",
    group: "to-pdf",
    icon: Presentation,
    processor: "officeToPdf",
    accept: PPT_ACCEPT,
    multiple: true,
  }),
  tool({
    slug: "excel-to-pdf",
    category: "convert",
    group: "to-pdf",
    icon: Sheet,
    processor: "officeToPdf",
    accept: EXCEL_ACCEPT,
    multiple: true,
  }),
  tool({
    slug: "html-to-pdf",
    category: "convert",
    group: "to-pdf",
    icon: Globe,
    processor: "htmlToPdf",
    accept: HTML_ACCEPT,
    minFiles: 0,
  }),

  // ---------- Convert: from PDF ----------
  tool({
    slug: "pdf-to-word",
    category: "convert",
    group: "from-pdf",
    icon: FileText,
    processor: "pdfToWord",
    output: "docx",
  }),
  tool({
    slug: "pdf-to-powerpoint",
    category: "convert",
    group: "from-pdf",
    icon: Presentation,
    processor: "pdfToPowerpoint",
    output: "pptx",
  }),
  tool({
    slug: "pdf-to-excel",
    category: "convert",
    group: "from-pdf",
    icon: Table2,
    processor: "pdfToExcel",
    output: "xlsx",
  }),
  tool({
    slug: "pdf-to-jpg",
    category: "convert",
    group: "from-pdf",
    icon: Images,
    processor: "pdfToJpg",
    output: "zip",
  }),
  tool({
    slug: "pdf-to-pdfa",
    category: "convert",
    group: "from-pdf",
    icon: Archive,
    processor: "pdfToPdfA",
  }),

  // ---------- Edit ----------
  tool({ slug: "edit-pdf", category: "edit", icon: PenLine, processor: "editPdf", editor: "canvas" }),
  tool({ slug: "rotate-pdf", category: "edit", icon: RotateCw, processor: "rotate", multiple: true }),
  tool({ slug: "add-page-numbers", category: "edit", icon: Hash, processor: "pageNumbers" }),
  tool({ slug: "watermark-pdf", category: "edit", icon: Droplets, processor: "watermark" }),
  tool({ slug: "crop-pdf", category: "edit", icon: Crop, processor: "crop", editor: "crop" }),
  tool({
    slug: "pdf-forms",
    category: "edit",
    icon: TextCursorInput,
    processor: "pdfForms",
    editor: "forms",
    badge: "new",
  }),

  // ---------- Security ----------
  tool({ slug: "sign-pdf", category: "security", icon: PenTool, processor: "sign", editor: "sign" }),
  tool({ slug: "unlock-pdf", category: "security", icon: LockOpen, processor: "unlock", multiple: true }),
  tool({ slug: "protect-pdf", category: "security", icon: Lock, processor: "protect", multiple: true }),
  tool({ slug: "redact-pdf", category: "security", icon: EyeOff, processor: "redact", editor: "redact" }),
  tool({
    slug: "compare-pdf",
    category: "security",
    icon: GitCompare,
    processor: "compare",
    multiple: true,
    minFiles: 2,
    maxFiles: 2,
  }),

  // ---------- PDF Intelligence (not built yet) ----------
  tool({ slug: "summarize-pdf", category: "ai", icon: Sparkles, processor: "noop", status: "soon", output: "md" }),
  tool({ slug: "translate-pdf", category: "ai", icon: Languages, processor: "noop", status: "soon" }),
  tool({ slug: "pdf-to-markdown", category: "ai", icon: FileCode, processor: "noop", status: "soon", output: "md" }),
];

const BY_SLUG = new Map<string, ToolDef>(TOOLS.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDef | undefined {
  return BY_SLUG.get(slug);
}

export function getToolsByCategory(category: CategoryId): ToolDef[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getConvertGroup(group: ConvertGroup): ToolDef[] {
  return TOOLS.filter((t) => t.category === "convert" && t.group === group);
}

export const LIVE_TOOL_COUNT = TOOLS.filter((t) => t.status === "live").length;

/** Featured on the home page hero and the compact header nav. */
export const POPULAR_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "pdf-to-word",
  "jpg-to-pdf",
  "protect-pdf",
] as const;

/** Combined accept string for a native file input. */
export function acceptAttribute(accept: AcceptSpec): string {
  return [...accept.mime, ...accept.ext].join(",");
}

/** react-dropzone expects `{ [mime]: ext[] }`. */
export function dropzoneAccept(accept: AcceptSpec): Record<string, string[]> {
  return Object.fromEntries(accept.mime.map((mime) => [mime, accept.ext]));
}
