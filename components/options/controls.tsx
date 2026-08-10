"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import type { Anchor } from "@/lib/pdf/fonts";

/* Shared building blocks so every tool's options panel looks and behaves alike. */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="text-fg mb-1.5 block text-[13px] font-semibold">{label}</label>
      {children}
      {hint && <p className="text-fg-subtle mt-1.5 text-[11px] leading-relaxed">{hint}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="border-line bg-bg placeholder:text-fg-subtle focus:border-brand-600 h-9 w-full rounded-lg border px-3 text-sm transition-colors outline-none"
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="border-line bg-bg focus:border-brand-600 h-9 w-full rounded-lg border px-3 text-sm tabular-nums transition-colors outline-none"
      />
      {suffix && (
        <span className="text-fg-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  display,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  display?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-brand-600 h-1.5 flex-1 cursor-pointer"
      />
      <span className="text-fg-muted w-12 shrink-0 text-right text-xs tabular-nums">
        {display ?? value}
      </span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="border-line bg-bg focus:border-brand-600 h-9 w-full rounded-lg border px-2.5 text-sm transition-colors outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="bg-surface border-line flex gap-0.5 rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
            value === o.value
              ? "bg-elevated text-fg shadow-sm"
              : "text-fg-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RadioCards<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string }[];
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
              active
                ? "border-brand-600 bg-brand-600/8"
                : "border-line hover:border-line-strong bg-bg"
            }`}
          >
            <span
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                active ? "border-brand-600 bg-brand-600" : "border-line-strong"
              }`}
            >
              {active && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{o.label}</span>
              {o.description && (
                <span className="text-fg-subtle mt-0.5 block text-[11px] leading-snug">
                  {o.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label htmlFor={id} className="cursor-pointer text-[13px] font-medium">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-line size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-line bg-bg focus:border-brand-600 h-9 min-w-0 flex-1 rounded-lg border px-3 font-mono text-xs uppercase transition-colors outline-none"
      />
    </div>
  );
}

const ANCHORS: Anchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** Nine-cell placement picker used by the watermark and page-number tools. */
export function AnchorGrid({
  value,
  onChange,
}: {
  value: Anchor;
  onChange: (v: Anchor) => void;
}) {
  return (
    <div className="border-line bg-bg grid aspect-4/3 w-full grid-cols-3 grid-rows-3 gap-1 rounded-lg border p-1">
      {ANCHORS.map((anchor) => {
        const active = value === anchor;
        return (
          <button
            key={anchor}
            type="button"
            onClick={() => onChange(anchor)}
            aria-label={anchor}
            aria-pressed={active}
            className={`grid place-items-center rounded transition-colors ${
              active ? "bg-brand-600" : "hover:bg-surface"
            }`}
          >
            <span
              className={`size-1.5 rounded-full transition-colors ${
                active ? "bg-white" : "bg-line-strong"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * "All pages" versus an explicit range. Emits an empty string for all pages,
 * which is what parsePageRange treats as the default.
 */
export function PageRangeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const custom = value.trim().length > 0;

  return (
    <Field label={t.opt.pages} hint={custom ? t.opt.pagesHint : undefined}>
      <Segmented
        value={custom ? "custom" : "all"}
        onChange={(mode) => onChange(mode === "all" ? "" : "1")}
        options={[
          { value: "all", label: t.opt.allPages },
          { value: "custom", label: t.opt.customPages },
        ]}
      />
      {custom && (
        <div className="mt-2">
          <TextInput value={value} onChange={onChange} placeholder="1-3, 7, 9-10" />
        </div>
      )}
    </Field>
  );
}
