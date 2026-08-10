import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = ["", "/about", "/privacy", "/terms"].map((route) => ({
    url: `${SITE.url}${route}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.4,
  }));

  const toolPages = TOOLS.map((tool) => ({
    url: `${SITE.url}/${tool.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    // Tools that are not built yet should not be promoted as strongly.
    priority: tool.status === "live" ? 0.8 : 0.3,
  }));

  return [...staticPages, ...toolPages];
}
