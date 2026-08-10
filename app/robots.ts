import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Task URLs are single-use and hold user files; keep them out of indexes.
      disallow: ["/api/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
