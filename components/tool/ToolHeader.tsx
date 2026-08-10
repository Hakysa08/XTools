"use client";

import { useT } from "@/components/i18n/LocaleProvider";
import { getToolCopy } from "@/lib/i18n/tools";
import type { ToolDef } from "@/lib/tools/registry";

export function ToolHeader({ tool }: { tool: ToolDef }) {
  const t = useT();
  const copy = getToolCopy(t, tool.slug);
  const Icon = tool.icon;

  return (
    <div data-cat={tool.category} className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center sm:px-6">
      <span className="cat-tint mx-auto mb-5 grid size-16 place-items-center rounded-2xl">
        <Icon className="size-8" aria-hidden="true" />
      </span>

      <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {copy.name}
      </h1>

      <p className="text-fg-muted mx-auto mt-4 max-w-2xl leading-relaxed text-pretty">
        {copy.lead}
      </p>

      {tool.status === "soon" && (
        <span className="border-line text-fg-subtle mt-5 inline-block rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          {t.common.soon}
        </span>
      )}
    </div>
  );
}
