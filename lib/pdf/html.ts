import "server-only";
import type { Browser, PDFOptions } from "puppeteer";

/**
 * One shared Chromium instance for the whole process. Launching per request
 * costs roughly a second and a few hundred MB, which would make HTML-to-PDF
 * unusable under any real load.
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = (await import("puppeteer")).default;
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      });
      // Drop the cached promise if Chromium dies so the next call relaunches.
      browser.on("disconnected", () => {
        browserPromise = null;
      });
      return browser;
    })().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export type PaperFormat = "A4" | "Letter" | "Legal" | "A3" | "A5";

export interface HtmlToPdfOptions {
  format?: PaperFormat;
  landscape?: boolean;
  margin?: string;
  printBackground?: boolean;
  scale?: number;
  /** Extra time for late-loading web fonts and images. */
  settleMs?: number;
}

async function render(
  load: (page: Awaited<ReturnType<Browser["newPage"]>>) => Promise<void>,
  options: HtmlToPdfOptions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await load(page);

    if (options.settleMs) {
      await new Promise((resolve) => setTimeout(resolve, options.settleMs));
    }
    // Web fonts often resolve after load; without this, text renders as fallback.
    await page.evaluateHandle("document.fonts.ready").catch(() => {});

    const margin = options.margin ?? "12mm";
    const pdfOptions: PDFOptions = {
      format: options.format ?? "A4",
      landscape: options.landscape ?? false,
      printBackground: options.printBackground ?? true,
      scale: Math.min(2, Math.max(0.1, options.scale ?? 1)),
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    };

    const bytes = await page.pdf(pdfOptions);
    return Buffer.from(bytes);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function htmlStringToPdf(
  html: string,
  options: HtmlToPdfOptions = {},
): Promise<Buffer> {
  return render(async (page) => {
    // setContent only accepts load/domcontentloaded; inlined assets are already
    // present, and the fonts.ready wait below covers late web fonts.
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
  }, options);
}

export async function urlToPdf(url: string, options: HtmlToPdfOptions = {}): Promise<Buffer> {
  return render(async (page) => {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
  }, options);
}

/**
 * Only http(s) is allowed, and only to public hosts. Without this a user could
 * point the tool at localhost or cloud metadata endpoints and read them back
 * inside a PDF.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That does not look like a valid web address");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses are supported");
  }

  const host = url.hostname.toLowerCase();

  const blocked =
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\./.test(host);

  if (blocked) {
    throw new Error("That address is not reachable from this service");
  }

  return url;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => {});
}
