"use client";

import Link from "next/link";

import { useT } from "@/components/i18n/LocaleProvider";
import { getToolCopy } from "@/lib/i18n/tools";
import {
  getConvertGroup,
  getToolsByCategory,
  type CategoryId,
  type ToolDef,
} from "@/lib/tools/registry";

function ToolLink({ tool, onNavigate }: { tool: ToolDef; onNavigate?: () => void }) {
  const t = useT();
  const copy = getToolCopy(t, tool.slug);
  const Icon = tool.icon;

  return (
    <li>
      <Link
        href={`/${tool.slug}`}
        onClick={onNavigate}
        data-cat={tool.category}
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface"
      >
        <Icon className="cat-fg size-4 shrink-0" aria-hidden="true" />
        <span className="text-fg-muted group-hover:text-fg truncate transition-colors">
          {copy.name}
        </span>
        {tool.status === "soon" && (
          <span className="text-fg-subtle border-line ml-auto shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase">
            {t.common.soon}
          </span>
        )}
        {tool.badge === "new" && tool.status === "live" && (
          <span className="ml-auto shrink-0 rounded bg-brand-600 px-1.5 py-px text-[10px] font-semibold tracking-wide text-white uppercase">
            {t.common.new}
          </span>
        )}
      </Link>
    </li>
  );
}

function Column({
  category,
  label,
  tools,
  onNavigate,
}: {
  category: CategoryId;
  label: string;
  tools: ToolDef[];
  onNavigate?: () => void;
}) {
  return (
    <div data-cat={category}>
      <p className="cat-fg mb-2 px-2 text-[11px] font-bold tracking-widest uppercase">{label}</p>
      <ul className="space-y-0.5">
        {tools.map((tool) => (
          <ToolLink key={tool.slug} tool={tool} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

export function MegaMenuPanel({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
      <Column
        category="organize"
        label={t.categories.organize}
        tools={getToolsByCategory("organize")}
        onNavigate={onNavigate}
      />

      <div className="space-y-7">
        <Column
          category="optimize"
          label={t.categories.optimize}
          tools={getToolsByCategory("optimize")}
          onNavigate={onNavigate}
        />
        <Column
          category="edit"
          label={t.categories.edit}
          tools={getToolsByCategory("edit")}
          onNavigate={onNavigate}
        />
      </div>

      <div className="space-y-7">
        <Column
          category="convert"
          label={t.convertGroups["to-pdf"]}
          tools={getConvertGroup("to-pdf")}
          onNavigate={onNavigate}
        />
        <Column
          category="convert"
          label={t.convertGroups["from-pdf"]}
          tools={getConvertGroup("from-pdf")}
          onNavigate={onNavigate}
        />
      </div>

      <div className="space-y-7">
        <Column
          category="security"
          label={t.categories.security}
          tools={getToolsByCategory("security")}
          onNavigate={onNavigate}
        />
        <Column
          category="ai"
          label={t.categories.ai}
          tools={getToolsByCategory("ai")}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
