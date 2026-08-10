"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { ToolCard } from "@/components/home/ToolCard";
import { ToolHeader } from "@/components/tool/ToolHeader";
import { ToolWorkspace } from "@/components/tool/ToolWorkspace";
import { getToolCopy } from "@/lib/i18n/tools";
import { getTool, getToolsByCategory } from "@/lib/tools/registry";

function ComingSoon({ slug }: { slug: string }) {
  const t = useT();
  const tool = getTool(slug);
  if (!tool) return null;

  const siblings = getToolsByCategory(tool.category)
    .filter((s) => s.slug !== slug && s.status === "live")
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-4 text-center sm:px-6">
      <div className="card p-10">
        <h2 className="text-lg font-bold">{t.workspace.comingSoonTitle}</h2>
        <p className="text-fg-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          {t.workspace.comingSoonBody}
        </p>
        {siblings.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {siblings.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="border-line hover:border-brand-600 hover:text-brand-600 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              >
                {getToolCopy(t, s.slug).name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ToolPageBody({ slug }: { slug: string }) {
  const t = useT();
  const tool = getTool(slug);
  if (!tool) return null;

  const related = getToolsByCategory(tool.category)
    .filter((s) => s.slug !== slug)
    .slice(0, 4);

  return (
    <>
      <ToolHeader tool={tool} />

      {tool.status === "soon" ? <ComingSoon slug={slug} /> : <ToolWorkspace tool={tool} />}

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">{t.workspace.otherTools}</h2>
            <Link
              href="/"
              className="text-brand-600 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {t.home.heroCtaPrimary}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((s) => (
              <ToolCard key={s.slug} tool={s} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
