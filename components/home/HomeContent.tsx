"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Search, Shield, X, Zap } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { ToolCard } from "@/components/home/ToolCard";
import { getToolCopy } from "@/lib/i18n/tools";
import {
  CATEGORY_ORDER,
  LIVE_TOOL_COUNT,
  TOOLS,
  getToolsByCategory,
} from "@/lib/tools/registry";

const WHY_ICONS = [Zap, Clock, Shield];

export function HomeContent() {
  const t = useT();
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!normalized) return null;
    return TOOLS.filter((tool) => {
      const copy = getToolCopy(t, tool.slug);
      return (
        copy.name.toLowerCase().includes(normalized) ||
        copy.short.toLowerCase().includes(normalized) ||
        tool.slug.includes(normalized)
      );
    });
  }, [normalized, t]);

  return (
    <>
      <section className="relative overflow-hidden">
        {/* Soft brand wash behind the hero. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] dark:opacity-25"
          style={{
            background:
              "radial-gradient(60rem 30rem at 50% -10%, var(--color-brand-500), transparent 65%)",
          }}
        />

        <div className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
            {t.home.heroTitle} <span className="brand-text">{t.home.heroTitleAccent}</span>
          </h1>

          <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            {t.home.heroSubtitle}
          </p>

          <div className="text-fg-subtle mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
            <span>
              <span className="text-fg font-bold">{LIVE_TOOL_COUNT}</span> {t.home.statTools}
            </span>
            <span className="bg-line-strong hidden size-1 rounded-full sm:block" />
            <span>{t.home.statFree}</span>
            <span className="bg-line-strong hidden size-1 rounded-full sm:block" />
            <span>{t.home.statNoAccount}</span>
          </div>

          <div className="relative mx-auto mt-9 max-w-xl">
            <Search
              className="text-fg-subtle pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.home.searchPlaceholder}
              aria-label={t.home.searchPlaceholder}
              className="border-line bg-elevated placeholder:text-fg-subtle focus:border-brand-600 h-13 w-full rounded-xl border py-3 pr-11 pl-12 text-[15px] shadow-sm transition-colors outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t.home.searchClear}
                className="btn text-fg-subtle hover:text-fg absolute top-1/2 right-2 size-8 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {matches ? (
          matches.length > 0 ? (
            <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {matches.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          ) : (
            <p className="text-fg-muted py-16 text-center">{t.home.searchEmpty}</p>
          )
        ) : (
          <div className="space-y-14">
            {CATEGORY_ORDER.map((category) => (
              <div key={category} data-cat={category}>
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {t.categories[category]}
                  </h2>
                  <span className="cat-fg h-px flex-1 opacity-25" style={{ background: "currentColor" }} />
                </div>
                <p className="text-fg-muted -mt-3 mb-5 text-sm">{t.categoryDesc[category]}</p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {getToolsByCategory(category).map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-line bg-surface border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">{t.home.whyTitle}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {t.home.why.map((item, i) => {
              const Icon = WHY_ICONS[i] ?? Zap;
              return (
                <div key={item.title}>
                  <span className="bg-brand-600/12 text-brand-600 mb-4 grid size-11 place-items-center rounded-xl">
                    <Icon className="size-[22px]" aria-hidden="true" />
                  </span>
                  <h3 className="mb-1.5 font-semibold">{item.title}</h3>
                  <p className="text-fg-muted text-sm leading-relaxed">{item.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/merge-pdf"
              className="btn brand-gradient h-12 px-7 text-[15px] text-white hover:opacity-90"
            >
              {t.home.heroCtaSecondary}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
