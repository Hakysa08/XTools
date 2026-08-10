"use client";

import Link from "next/link";

import { useT } from "@/components/i18n/LocaleProvider";
import { getToolCopy } from "@/lib/i18n/tools";
import { SITE } from "@/lib/site";
import { CATEGORY_ORDER, getToolsByCategory } from "@/lib/tools/registry";

export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-7">
          <div className="col-span-2 lg:col-span-2">
            <p className="text-[1.3rem] leading-none font-extrabold tracking-tight">
              <span className="brand-text">X</span>
              <span className="text-fg">Tools</span>
            </p>
            <p className="text-fg-muted mt-3 max-w-xs text-sm leading-relaxed">{t.footer.blurb}</p>
          </div>

          {CATEGORY_ORDER.slice(0, 4).map((category) => (
            <div key={category} data-cat={category}>
              <p className="text-fg mb-3 text-sm font-bold">{t.categories[category]}</p>
              <ul className="space-y-2">
                {getToolsByCategory(category).map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/${tool.slug}`}
                      className="text-fg-muted hover:text-fg text-sm transition-colors"
                    >
                      {getToolCopy(t, tool.slug).name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-fg mb-3 text-sm font-bold">{t.categories.security}</p>
            <ul className="space-y-2">
              {getToolsByCategory("security").map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/${tool.slug}`}
                    className="text-fg-muted hover:text-fg text-sm transition-colors"
                  >
                    {getToolCopy(t, tool.slug).name}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-fg mt-6 mb-3 text-sm font-bold">{t.footer.legal}</p>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-fg-muted hover:text-fg text-sm transition-colors">
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-fg-muted hover:text-fg text-sm transition-colors"
                >
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-fg-muted hover:text-fg text-sm transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-line text-fg-subtle mt-12 flex flex-col gap-2 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.name}. {t.footer.rights}
          </p>
          <p>{t.meta.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
