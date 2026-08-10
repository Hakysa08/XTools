"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { getToolCopy } from "@/lib/i18n/tools";
import { POPULAR_SLUGS, getTool } from "@/lib/tools/registry";

import { LangSwitcher } from "./LangSwitcher";
import { Logo } from "./Logo";
import { MegaMenuPanel } from "./MegaMenu";
import { ThemeToggle } from "./ThemeToggle";

const QUICK_LINKS = ["merge-pdf", "split-pdf", "compress-pdf"] as const;

export function Header() {
  const t = useT();
  const pathname = usePathname();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  // Any navigation closes whatever is open.
  useEffect(() => {
    setMegaOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!megaOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!megaRef.current?.contains(e.target as Node)) setMegaOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMegaOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [megaOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="bg-bg/85 border-line sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {QUICK_LINKS.map((slug) => {
            const tool = getTool(slug);
            if (!tool) return null;
            return (
              <Link
                key={slug}
                href={`/${slug}`}
                className="text-fg-muted hover:text-fg hover:bg-surface rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                {getToolCopy(t, slug).name}
              </Link>
            );
          })}

          <div ref={megaRef} className="relative">
            <button
              type="button"
              onClick={() => setMegaOpen((v) => !v)}
              aria-expanded={megaOpen}
              className="text-fg-muted hover:text-fg hover:bg-surface flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {t.nav.allTools}
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LangSwitcher />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={mobileOpen}
            className="btn hover:bg-surface text-fg-muted hover:text-fg size-9 lg:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Desktop mega menu */}
      {megaOpen && (
        <div
          className="border-line bg-bg absolute inset-x-0 top-16 hidden border-b lg:block"
          style={{ boxShadow: "var(--shadow-panel)" }}
          onMouseLeave={() => setMegaOpen(false)}
        >
          <div className="mx-auto max-w-7xl px-6 py-7 lg:px-8">
            <MegaMenuPanel onNavigate={() => setMegaOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-line bg-bg fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t px-4 py-6 lg:hidden">
          <div className="mb-6 flex flex-wrap gap-2">
            {POPULAR_SLUGS.slice(0, 4).map((slug) => (
              <Link
                key={slug}
                href={`/${slug}`}
                onClick={() => setMobileOpen(false)}
                className="border-line hover:border-brand-600 hover:text-brand-600 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {getToolCopy(t, slug).name}
              </Link>
            ))}
          </div>
          <MegaMenuPanel onNavigate={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  );
}
