import type { Metadata } from "next";

import { HomeContent } from "@/components/home/HomeContent";
import { getServerDictionary } from "@/lib/i18n/server";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return {
    title: `${SITE.name} — ${t.meta.tagline}`,
    description: t.meta.siteDescription,
    alternates: { canonical: "/" },
  };
}

export default function HomePage() {
  return <HomeContent />;
}
