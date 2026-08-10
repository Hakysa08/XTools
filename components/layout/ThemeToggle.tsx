"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // The resolved theme is only known client-side, so render a stable placeholder first.
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      aria-label={t.nav.toggleTheme}
      className="btn hover:bg-surface text-fg-muted hover:text-fg size-9"
    >
      {mounted && resolved === "dark" ? (
        <Sun className="size-[18px]" aria-hidden="true" />
      ) : (
        <Moon className="size-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
