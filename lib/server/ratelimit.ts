import "server-only";

/**
 * In-process sliding-window limiter. Good enough for a single-node deployment;
 * a multi-node setup would need shared state.
 */
const WINDOW_MS = 60_000;
/*
 * Each tool run costs several requests (create, upload, process, download), so
 * this needs headroom: at 40/min a user could only complete ten operations a
 * minute, which batch work hits immediately.
 */
const MAX_PER_WINDOW = 150;

const hits = new Map<string, number[]>();

export function clientKey(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}

export function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}
