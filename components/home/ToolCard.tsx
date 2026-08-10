"use client";

import Link from "next/link";

import { useT } from "@/components/i18n/LocaleProvider";
import { getToolCopy } from "@/lib/i18n/tools";
import type { ToolDef } from "@/lib/tools/registry";

export function ToolCard({ tool }: { tool: ToolDef }) {
  const t = useT();
  const copy = getToolCopy(t, tool.slug);
  const Icon = tool.icon;

  return (
    <Link
      href={`/${tool.slug}`}
      data-cat={tool.category}
      className="card card-lift group relative flex flex-col p-5"
    >
      {tool.status === "soon" && (
        <span className="text-fg-subtle border-line absolute top-4 right-4 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          {t.common.soon}
        </span>
      )}
      {tool.badge === "new" && tool.status === "live" && (
        <span className="bg-brand-600 absolute top-4 right-4 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
          {t.common.new}
        </span>
      )}

      <span className="cat-tint mb-3.5 grid size-11 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-110">
        <Icon className="size-[22px]" aria-hidden="true" />
      </span>

      <h3 className="text-fg mb-1 leading-snug font-semibold">{copy.name}</h3>
      <p className="text-fg-muted text-[13px] leading-relaxed">{copy.short}</p>
    </Link>
  );
}
