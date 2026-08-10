"use client";

import { useT } from "@/components/i18n/LocaleProvider";
import type { Anchor, FontChoice } from "@/lib/pdf/fonts";

import {
  AnchorGrid,
  ColorInput,
  Field,
  NumberInput,
  PageRangeField,
  RadioCards,
  Segmented,
  Select,
  Slider,
  TextInput,
  Toggle,
} from "./controls";
import { SignaturePad } from "./SignaturePad";
import type { OptionsPanelProps } from "./types";

/*
 * Readers for the loosely-typed options bag. `str` deliberately widens to
 * `string` so comparing against other literals stays legal.
 */
function read<T>(value: Record<string, unknown>, key: string, fallback: T): T {
  const found = value[key];
  return (found === undefined ? fallback : found) as T;
}

function str(value: Record<string, unknown>, key: string, fallback: string): string {
  const found = value[key];
  return typeof found === "string" ? found : fallback;
}

function num(value: Record<string, unknown>, key: string, fallback: number): number {
  const found = value[key];
  return typeof found === "number" && Number.isFinite(found) ? found : fallback;
}

function bool(value: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const found = value[key];
  return typeof found === "boolean" ? found : fallback;
}

const FONT_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: "helvetica", label: "Helvetica" },
  { value: "times", label: "Times" },
  { value: "courier", label: "Courier" },
];

// ------------------------------------------------------------ split

export function SplitOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  const mode = str(value, "mode", "ranges");

  return (
    <>
      <Field label={t.opt.splitMode}>
        <RadioCards
          value={mode}
          onChange={(mode) => onChange({ mode })}
          options={[
            { value: "ranges", label: t.opt.splitRanges, description: t.opt.splitRangesDesc },
            { value: "every", label: t.opt.splitEvery, description: t.opt.splitEveryDesc },
            { value: "all", label: t.opt.splitAll, description: t.opt.splitAllDesc },
          ]}
        />
      </Field>

      {mode === "ranges" && (
        <>
          <Field label={t.opt.pages} hint={t.opt.pagesHint}>
            <TextInput
              value={str(value, "pages", "")}
              onChange={(pages) => onChange({ pages })}
              placeholder="1-3, 7, 9-10"
            />
          </Field>
          <Toggle
            checked={bool(value, "merge", false)}
            onChange={(merge) => onChange({ merge })}
            label={t.opt.mergeIntoOne}
          />
        </>
      )}

      {mode === "every" && (
        <Field label={t.opt.everyN}>
          <NumberInput
            value={num(value, "everyN", 1)}
            onChange={(everyN) => onChange({ everyN })}
            min={1}
            max={1000}
          />
        </Field>
      )}
    </>
  );
}

// ------------------------------------------------- remove / extract pages

export function RemovePagesOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <Field label={t.opt.pages} hint={t.opt.pagesHint}>
      <TextInput
        value={str(value, "pages", "")}
        onChange={(pages) => onChange({ pages })}
        placeholder="2, 4, 6-8"
      />
    </Field>
  );
}

export function ExtractPagesOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.pages} hint={t.opt.pagesHint}>
        <TextInput
          value={str(value, "pages", "")}
          onChange={(pages) => onChange({ pages })}
          placeholder="1-3, 7"
        />
      </Field>
      <Toggle
        checked={bool(value, "separate", false)}
        onChange={(separate) => onChange({ separate })}
        label={t.opt.separateFiles}
      />
    </>
  );
}

// ----------------------------------------------------------- rotate

export function RotateOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.rotationAmount}>
        <Segmented
          value={String(num(value, "rotation", 90))}
          onChange={(v) => onChange({ rotation: Number(v) })}
          options={[
            { value: "90", label: t.opt.rotate90 },
            { value: "180", label: t.opt.rotate180 },
            { value: "270", label: t.opt.rotate270 },
          ]}
        />
      </Field>
      <PageRangeField
        value={str(value, "pages", "")}
        onChange={(pages) => onChange({ pages })}
      />
    </>
  );
}

// ----------------------------------------------------- page numbers

export function PageNumberOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();

  return (
    <>
      <Field label={t.opt.position}>
        <AnchorGrid
          value={read<Anchor>(value, "position", "bottom-center")}
          onChange={(position) => onChange({ position })}
        />
      </Field>

      <Field label={t.opt.format}>
        <Select
          value={str(value, "format", "n")}
          onChange={(format) => onChange({ format })}
          options={[
            { value: "n", label: "1" },
            { value: "n-of-N", label: "1 / 10" },
            { value: "page-n-of-N", label: "Page 1 of 10" },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.opt.font}>
          <Select
            value={read<FontChoice>(value, "font", "helvetica")}
            onChange={(font) => onChange({ font })}
            options={FONT_OPTIONS}
          />
        </Field>
        <Field label={t.opt.fontSize}>
          <NumberInput
            value={num(value, "fontSize", 12)}
            onChange={(fontSize) => onChange({ fontSize })}
            min={6}
            max={72}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.opt.margin}>
          <NumberInput
            value={num(value, "margin", 32)}
            onChange={(margin) => onChange({ margin })}
            min={0}
            max={200}
          />
        </Field>
        <Field label={t.opt.startNumber}>
          <NumberInput
            value={num(value, "startNumber", 1)}
            onChange={(startNumber) => onChange({ startNumber })}
            min={0}
          />
        </Field>
      </div>

      <Field label={t.opt.color}>
        <ColorInput
          value={read(value, "color", "#000000")}
          onChange={(color) => onChange({ color })}
        />
      </Field>

      <Toggle
        checked={bool(value, "bold", false)}
        onChange={(bold) => onChange({ bold })}
        label={t.opt.bold}
      />

      <PageRangeField value={str(value, "pages", "")} onChange={(pages) => onChange({ pages })} />
    </>
  );
}

// -------------------------------------------------------- watermark

export function WatermarkOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  const mode = str(value, "mode", "text");
  const layer = str(value, "layer", "over");

  return (
    <>
      <Field label={t.opt.watermarkMode}>
        <Segmented
          value={mode}
          onChange={(mode) => onChange({ mode })}
          options={[
            { value: "text", label: t.opt.modeText },
            { value: "image", label: t.opt.modeImage },
          ]}
        />
      </Field>

      {mode === "text" ? (
        <>
          <Field label={t.opt.text}>
            <TextInput
              value={str(value, "text", "XTools")}
              onChange={(text) => onChange({ text })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.opt.font}>
              <Select
                value={read<FontChoice>(value, "font", "helvetica")}
                onChange={(font) => onChange({ font })}
                options={FONT_OPTIONS}
              />
            </Field>
            <Field label={t.opt.fontSize}>
              <NumberInput
                value={num(value, "fontSize", 48)}
                onChange={(fontSize) => onChange({ fontSize })}
                min={8}
                max={200}
              />
            </Field>
          </div>

          <Field label={t.opt.color}>
            <ColorInput
              value={read(value, "color", "#888888")}
              onChange={(color) => onChange({ color })}
            />
          </Field>
        </>
      ) : (
        <Field label={t.opt.imageScale} hint={t.opt.imageHint}>
          <Slider
            value={Math.round(num(value, "imageScale", 0.4) * 100)}
            onChange={(v) => onChange({ imageScale: v / 100 })}
            min={5}
            max={100}
            display={`${Math.round(num(value, "imageScale", 0.4) * 100)}%`}
          />
        </Field>
      )}

      <Field label={t.opt.position}>
        <AnchorGrid
          value={read<Anchor>(value, "position", "middle-center")}
          onChange={(position) => onChange({ position })}
        />
      </Field>

      <Field label={t.opt.opacity}>
        <Slider
          value={Math.round(num(value, "opacity", 0.35) * 100)}
          onChange={(v) => onChange({ opacity: v / 100 })}
          min={5}
          max={100}
          display={`${Math.round(num(value, "opacity", 0.35) * 100)}%`}
        />
      </Field>

      <Field label={t.opt.rotation}>
        <Slider
          value={num(value, "rotation", 45)}
          onChange={(rotation) => onChange({ rotation })}
          min={-90}
          max={90}
          step={5}
          display={`${num(value, "rotation", 45)}°`}
        />
      </Field>

      <Field label={t.opt.layer} hint={layer === "below" ? t.opt.layerBelowNote : undefined}>
        <Segmented
          value={layer}
          onChange={(layer) => onChange({ layer })}
          options={[
            { value: "over", label: t.opt.layerOver },
            { value: "below", label: t.opt.layerBelow },
          ]}
        />
      </Field>

      <Toggle
        checked={bool(value, "tile", false)}
        onChange={(tile) => onChange({ tile })}
        label={t.opt.tile}
      />

      <PageRangeField value={str(value, "pages", "")} onChange={(pages) => onChange({ pages })} />
    </>
  );
}

// ------------------------------------------------------------- crop

export function CropOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();

  const edge = (key: "left" | "top" | "right" | "bottom", label: string) => (
    <Field label={label}>
      <NumberInput
        value={Math.round(num(value, key, 0) * 100)}
        onChange={(v) => onChange({ [key]: Math.min(95, Math.max(0, v)) / 100 })}
        min={0}
        max={95}
        suffix="%"
      />
    </Field>
  );

  return (
    <>
      <p className="text-fg-subtle mb-3 text-[11px] leading-relaxed">{t.opt.cropHint}</p>
      <div className="grid grid-cols-2 gap-3">
        {edge("left", t.opt.cropLeft)}
        {edge("right", t.opt.cropRight)}
        {edge("top", t.opt.cropTop)}
        {edge("bottom", t.opt.cropBottom)}
      </div>
      <PageRangeField value={str(value, "pages", "")} onChange={(pages) => onChange({ pages })} />
    </>
  );
}

// ------------------------------------------------------- jpg to pdf

export function JpgToPdfOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  const pageSize = str(value, "pageSize", "a4");

  return (
    <>
      <Field label={t.opt.pageSize}>
        <Select
          value={pageSize}
          onChange={(pageSize) => onChange({ pageSize })}
          options={[
            { value: "a4", label: "A4" },
            { value: "letter", label: "Letter" },
            { value: "legal", label: "Legal" },
            { value: "a3", label: "A3" },
            { value: "a5", label: "A5" },
            { value: "fit", label: t.opt.sizeFit },
          ]}
        />
      </Field>

      {pageSize !== "fit" && (
        <Field label={t.opt.orientation}>
          <Segmented
            value={str(value, "orientation", "portrait")}
            onChange={(orientation) => onChange({ orientation })}
            options={[
              { value: "portrait", label: t.opt.portrait },
              { value: "landscape", label: t.opt.landscape },
              { value: "auto", label: t.opt.auto },
            ]}
          />
        </Field>
      )}

      <Field label={t.opt.margin}>
        <Segmented
          value={str(value, "margin", "small")}
          onChange={(margin) => onChange({ margin })}
          options={[
            { value: "none", label: t.opt.marginNone },
            { value: "small", label: t.opt.marginSmall },
            { value: "big", label: t.opt.marginBig },
          ]}
        />
      </Field>

      <Field label={t.opt.fitMode}>
        <Segmented
          value={str(value, "fit", "fit")}
          onChange={(fit) => onChange({ fit })}
          options={[
            { value: "fit", label: t.opt.fitContain },
            { value: "fill", label: t.opt.fitCover },
          ]}
        />
      </Field>

      <Toggle
        checked={bool(value, "separate", false)}
        onChange={(separate) => onChange({ separate })}
        label={t.opt.separateFiles}
      />
    </>
  );
}

// -------------------------------------------------------- compress

export function CompressOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.compressLevel}>
        <RadioCards
          value={str(value, "level", "recommended")}
          onChange={(level) => onChange({ level })}
          options={[
            { value: "low", label: t.opt.compressLow, description: t.opt.compressLowDesc },
            {
              value: "recommended",
              label: t.opt.compressRecommended,
              description: t.opt.compressRecommendedDesc,
            },
            {
              value: "extreme",
              label: t.opt.compressExtreme,
              description: t.opt.compressExtremeDesc,
            },
          ]}
        />
      </Field>
      <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.compressNote}</p>
    </>
  );
}

// ------------------------------------------------------ pdf to jpg

export function PdfToJpgOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  const format = str(value, "format", "jpeg");

  return (
    <>
      <Field label={t.opt.imageFormat}>
        <Segmented
          value={format}
          onChange={(format) => onChange({ format })}
          options={[
            { value: "jpeg", label: "JPG" },
            { value: "png", label: "PNG" },
          ]}
        />
      </Field>

      <Field label={t.opt.resolution}>
        <Select
          value={String(num(value, "dpi", 150))}
          onChange={(v) => onChange({ dpi: Number(v) })}
          options={[
            { value: "72", label: "72 DPI" },
            { value: "150", label: "150 DPI" },
            { value: "200", label: "200 DPI" },
            { value: "300", label: "300 DPI" },
          ]}
        />
      </Field>

      {format === "jpeg" && (
        <Field label={t.opt.quality}>
          <Slider
            value={num(value, "quality", 85)}
            onChange={(quality) => onChange({ quality })}
            min={30}
            max={100}
            display={`${num(value, "quality", 85)}%`}
          />
        </Field>
      )}
    </>
  );
}

// ------------------------------------------------------------- OCR

export function OcrOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.ocrLanguage}>
        <Select
          value={str(value, "language", "ind+eng")}
          onChange={(language) => onChange({ language })}
          options={[
            { value: "ind+eng", label: t.opt.ocrIndEng },
            { value: "ind", label: t.opt.ocrInd },
            { value: "eng", label: t.opt.ocrEng },
          ]}
        />
      </Field>

      <Field label={t.opt.resolution}>
        <Select
          value={String(num(value, "dpi", 200))}
          onChange={(v) => onChange({ dpi: Number(v) })}
          options={[
            { value: "150", label: "150 DPI" },
            { value: "200", label: "200 DPI" },
            { value: "300", label: "300 DPI" },
          ]}
        />
      </Field>

      <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.ocrNote}</p>
    </>
  );
}

// ----------------------------------------------------------- PDF/A

export function PdfAOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.conformance}>
        <Segmented
          value={str(value, "conformance", "2B")}
          onChange={(conformance) => onChange({ conformance })}
          options={[
            { value: "1B", label: "PDF/A-1B" },
            { value: "2B", label: "PDF/A-2B" },
            { value: "3B", label: "PDF/A-3B" },
          ]}
        />
      </Field>
      <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.pdfaNote}</p>
    </>
  );
}

// -------------------------------------------------- office -> pdf

const PAPER_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "Letter", label: "Letter" },
  { value: "Legal", label: "Legal" },
  { value: "A3", label: "A3" },
  { value: "A5", label: "A5" },
];

export function OfficeToPdfOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.paperFormat}>
        <Select
          value={str(value, "format", "A4")}
          onChange={(format) => onChange({ format })}
          options={PAPER_OPTIONS}
        />
      </Field>
      <Toggle
        checked={bool(value, "landscape", false)}
        onChange={(landscape) => onChange({ landscape })}
        label={t.opt.landscapeMode}
      />
      <p className="text-fg-subtle mt-3 text-[11px] leading-relaxed">{t.opt.officeNote}</p>
    </>
  );
}

// ---------------------------------------------------- html -> pdf

export function HtmlToPdfOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.sourceUrl} hint={t.opt.sourceUrlHint}>
        <TextInput
          value={str(value, "url", "")}
          onChange={(url) => onChange({ url })}
          placeholder="https://example.com"
          type="url"
        />
      </Field>
      <Field label={t.opt.paperFormat}>
        <Select
          value={str(value, "format", "A4")}
          onChange={(format) => onChange({ format })}
          options={PAPER_OPTIONS}
        />
      </Field>
      <Field label={t.opt.pageMargin}>
        <Segmented
          value={str(value, "margin", "12mm")}
          onChange={(margin) => onChange({ margin })}
          options={[
            { value: "0mm", label: t.opt.marginNone },
            { value: "12mm", label: t.opt.marginSmall },
            { value: "24mm", label: t.opt.marginBig },
          ]}
        />
      </Field>
      <Toggle
        checked={bool(value, "landscape", false)}
        onChange={(landscape) => onChange({ landscape })}
        label={t.opt.landscapeMode}
      />
    </>
  );
}

// ---------------------------------------------------- pdf -> office

export function FromPdfNote() {
  const t = useT();
  return <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.fromPdfNote}</p>;
}

export function PdfToPowerpointOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.resolution}>
        <Select
          value={String(num(value, "dpi", 150))}
          onChange={(v) => onChange({ dpi: Number(v) })}
          options={[
            { value: "110", label: "110 DPI" },
            { value: "150", label: "150 DPI" },
            { value: "200", label: "200 DPI" },
          ]}
        />
      </Field>
    </>
  );
}

// -------------------------------------------------------- security

export function ProtectOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.password} hint={t.opt.passwordHint}>
        <TextInput
          value={str(value, "password", "")}
          onChange={(password) => onChange({ password })}
          type="password"
          placeholder="••••••••"
        />
      </Field>

      <p className="text-fg mb-2 text-[13px] font-semibold">{t.opt.permissions}</p>
      <Toggle
        checked={bool(value, "allowPrinting", true)}
        onChange={(allowPrinting) => onChange({ allowPrinting })}
        label={t.opt.allowPrinting}
      />
      <Toggle
        checked={bool(value, "allowCopying", true)}
        onChange={(allowCopying) => onChange({ allowCopying })}
        label={t.opt.allowCopying}
      />
      <Toggle
        checked={bool(value, "allowModifying", false)}
        onChange={(allowModifying) => onChange({ allowModifying })}
        label={t.opt.allowModifying}
      />
      <Toggle
        checked={bool(value, "allowAnnotating", false)}
        onChange={(allowAnnotating) => onChange({ allowAnnotating })}
        label={t.opt.allowAnnotating}
      />
    </>
  );
}

export function UnlockOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  return (
    <>
      <Field label={t.opt.password} hint={t.opt.passwordUnlockHint}>
        <TextInput
          value={str(value, "password", "")}
          onChange={(password) => onChange({ password })}
          type="password"
          placeholder="••••••••"
        />
      </Field>
      <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.unlockNote}</p>
    </>
  );
}

export function RedactOptions({ value, onChange }: OptionsPanelProps) {
  const t = useT();
  const terms = (Array.isArray(value.searchTerms) ? (value.searchTerms as string[]) : []).join(", ");

  return (
    <>
      <Field label={t.opt.redactSearch} hint={t.opt.redactSearchHint}>
        <TextInput
          value={terms}
          onChange={(raw) =>
            onChange({
              searchTerms: raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="nama, alamat, nomor rekening"
        />
      </Field>
      <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.redactNote}</p>
    </>
  );
}

export function CompareNote() {
  const t = useT();
  return <p className="text-fg-subtle text-[11px] leading-relaxed">{t.opt.compareNote}</p>;
}

export function SignOptions({ tool, files, value, onChange }: OptionsPanelProps) {
  const t = useT();
  const mode = str(value, "mode", "draw");
  const anchor = read<Anchor>(value, "position", "bottom-right");
  const size = num(value, "size", 0.22);
  const pageSpec = str(value, "pages", "last");

  /*
   * The options panel does not know the page count, so placements are derived
   * from the chosen anchor and size and recomputed whenever either changes.
   * `pages` is resolved against the real document on the server.
   */
  const syncPlacements = (patch: Record<string, unknown>) => {
    const next = { ...value, ...patch };
    const nextAnchor = read<Anchor>(next, "position", "bottom-right");
    const nextSize = num(next, "size", 0.22);
    const [vertical, horizontal] = nextAnchor.split("-");

    const width = nextSize;
    const height = nextSize * 0.38;
    const margin = 0.05;

    const x =
      horizontal === "left" ? margin : horizontal === "right" ? 1 - width - margin : (1 - width) / 2;
    const y =
      vertical === "top" ? margin : vertical === "bottom" ? 1 - height - margin : (1 - height) / 2;

    onChange({ ...patch, placement: { x, y, width, height } });
  };

  return (
    <>
      <Field label={t.opt.signMode}>
        <Segmented
          value={mode}
          onChange={(mode) => onChange({ mode })}
          options={[
            { value: "draw", label: t.opt.signDraw },
            { value: "type", label: t.opt.signType },
          ]}
        />
      </Field>

      {mode === "draw" ? (
        <div className="mb-4">
          <SignaturePad onChange={(signatureImage) => onChange({ signatureImage })} />
        </div>
      ) : (
        <Field label={t.opt.text}>
          <TextInput
            value={str(value, "text", "")}
            onChange={(text) => onChange({ text })}
            placeholder="Nama kamu"
          />
        </Field>
      )}

      <Field label={t.opt.position}>
        <AnchorGrid value={anchor} onChange={(position) => syncPlacements({ position })} />
      </Field>

      <Field label={t.opt.signSize}>
        <Slider
          value={Math.round(size * 100)}
          onChange={(v) => syncPlacements({ size: v / 100 })}
          min={8}
          max={60}
          display={`${Math.round(size * 100)}%`}
        />
      </Field>

      <Field label={t.opt.pages} hint={t.opt.pagesHint}>
        <TextInput
          value={pageSpec}
          onChange={(pages) => onChange({ pages })}
          placeholder="last"
        />
      </Field>

      <Toggle
        checked={bool(value, "stampDate", false)}
        onChange={(stampDate) => onChange({ stampDate })}
        label={t.opt.signStampDate}
      />

      <p className="text-fg-subtle mt-2 text-[11px] leading-relaxed">{t.opt.signNote}</p>
    </>
  );
}
