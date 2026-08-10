"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      // One year, site-wide. The root layout reads this back on the next render.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Keeps isolated component previews and tests from crashing.
    return { locale: DEFAULT_LOCALE, t: getDictionary(DEFAULT_LOCALE), setLocale: () => {} };
  }
  return ctx;
}

export function useT(): Dictionary {
  return useLocale().t;
}
