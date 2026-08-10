"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/lib/i18n";

export function LangSwitcher() {
  const { locale, t, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.language}
        className="btn hover:bg-surface text-fg-muted hover:text-fg h-9 gap-1.5 px-2.5 text-sm"
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="font-semibold">{LOCALE_SHORT[locale]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 z-50 mt-2 w-48 overflow-hidden p-1"
          style={{ boxShadow: "var(--shadow-panel)" }}
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              role="menuitemradio"
              aria-checked={l === locale}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className="hover:bg-surface flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors"
            >
              <span className="text-fg-subtle w-6 text-xs font-bold">{LOCALE_SHORT[l]}</span>
              <span className="flex-1">{LOCALE_LABELS[l]}</span>
              {l === locale && <Check className="text-brand-600 size-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
