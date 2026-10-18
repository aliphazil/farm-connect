import "server-only";

/**
 * A small fixed-window rate limiter kept in this server instance's memory.
 * It slows down floods from one source; it is not shared between instances,
 * so it's a first line of defence, not a guarantee (duplicate markers and
 * validation do the rest).
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}) {
  const hits = new Map<string, { count: number; start: number }>();
  return {
    /** True if the request is allowed. */
    take(key: string, now = Date.now()): boolean {
      const entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits)
            if (now - v.start >= windowMs) hits.delete(k);
          // Still full: forget the oldest entry rather than grow without bound.
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value!);
        }
        hits.set(key, { count: 1, start: now });
        return true;
      }
      entry.count++;
      return entry.count <= limit;
    },
    reset() {
      hits.clear();
    },
  };
}
