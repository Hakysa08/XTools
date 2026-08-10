import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";
import { getServerDictionary } from "@/lib/i18n/server";
import { SITE } from "@/lib/site";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Alat PDF Online Gratis`,
    template: `%s | ${SITE.name}`,
  },
  description:
    "Alat PDF online gratis: gabung, pisah, kompres, konversi, putar, buka kunci, dan beri watermark pada PDF.",
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getServerDictionary();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* No `font-sans` utility here: it would outrank the base-layer rule in
          globals.css that wires up the Inter variable from next/font. */}
      <body className={inter.variable}>
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <div className="flex min-h-dvh flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
