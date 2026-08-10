import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolPageBody } from "@/components/tool/ToolPageBody";
import { getDictionary } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { getToolCopy } from "@/lib/i18n/tools";
import { SITE } from "@/lib/site";
import { TOOLS, getTool } from "@/lib/tools/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ tool: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};

  const { locale, t } = await getServerDictionary();
  const copy = getToolCopy(t, slug);
  const other = getToolCopy(getDictionary(locale === "id" ? "en" : "id"), slug);

  return {
    title: copy.name,
    description: copy.lead,
    keywords: [copy.name, other.name, "PDF", SITE.name],
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: `${copy.name} | ${SITE.name}`,
      description: copy.lead,
      url: `/${slug}`,
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return <ToolPageBody slug={tool.slug} />;
}
