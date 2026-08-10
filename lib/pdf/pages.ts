/**
 * Page-range parsing shared by every tool that takes a "which pages" input.
 * Accepts forms like "1-3, 7, 9-" and "last", clamped to the document length.
 */

export class PageRangeError extends Error {}

/**
 * Returns sorted, de-duplicated 1-based page numbers.
 * An empty or blank spec means "every page".
 */
export function parsePageRange(spec: string | undefined | null, totalPages: number): number[] {
  const all = () => Array.from({ length: totalPages }, (_, i) => i + 1);
  if (totalPages <= 0) return [];

  const raw = (spec ?? "").trim();
  if (!raw) return all();

  const normalized = raw.toLowerCase();
  if (normalized === "all" || normalized === "*") return all();

  const selected = new Set<number>();

  for (const rawPart of normalized.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const token = (value: string): number => {
      if (value === "last" || value === "end") return totalPages;
      if (value === "first") return 1;
      if (!/^\d+$/.test(value)) throw new PageRangeError(`Invalid page value: "${value}"`);
      return Number.parseInt(value, 10);
    };

    const dash = part.indexOf("-");
    if (dash === -1) {
      const page = token(part);
      if (page >= 1 && page <= totalPages) selected.add(page);
      continue;
    }

    const startRaw = part.slice(0, dash).trim();
    const endRaw = part.slice(dash + 1).trim();

    const start = startRaw ? token(startRaw) : 1;
    const end = endRaw ? token(endRaw) : totalPages;

    const [lo, hi] = start <= end ? [start, end] : [end, start];
    for (let p = Math.max(1, lo); p <= Math.min(totalPages, hi); p += 1) {
      selected.add(p);
    }
  }

  return [...selected].sort((a, b) => a - b);
}

/** Inverse of parsePageRange — the pages *not* named by the spec. */
export function invertPages(pages: number[], totalPages: number): number[] {
  const excluded = new Set(pages);
  const kept: number[] = [];
  for (let p = 1; p <= totalPages; p += 1) if (!excluded.has(p)) kept.push(p);
  return kept;
}

/** Collapses [1,2,3,7,9,10] into "1-3, 7, 9-10" for display. */
export function formatPageRange(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = current;
    }
    prev = current;
  }
  return parts.join(", ");
}

/** Splits a page list into contiguous runs, e.g. [1,2,3,7,8] -> [[1,3],[7,8]]. */
export function toContiguousRanges(pages: number[]): [number, number][] {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current !== prev + 1) {
      ranges.push([start, prev]);
      start = current;
    }
    prev = current;
  }
  return sorted.length ? ranges : [];
}
