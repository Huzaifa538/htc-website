/**
 * Simple in-memory rate limiter for API routes.
 *
 * Tracks attempts per key (usually client IP) inside a sliding window.
 * On Vercel serverless each instance has its own memory, so this is a
 * best-effort guard — good enough to slow down brute-force bots, and it
 * needs no extra dependency or paid service.
 *
 * Usage:
 *   import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
 *   const result = checkRateLimit(ip, { windowMs: 15 * 60_000, max: 5 });
 *   if (!result.allowed) {
 *     return NextResponse.json(
 *       { error: "Too many attempts. Try again later." },
 *       { status: 429, headers: rateLimitHeaders(result) }
 *     );
 *   }
 */

interface RateLimitOptions {
  /** Window length in milliseconds. Default: 15 minutes. */
  windowMs?: number;
  /** Max attempts allowed inside the window. Default: 5. */
  max?: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

const buckets = new Map<string, number[]>();

const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MAX = 5;

/** Remove buckets that have fully expired to keep memory small. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  const keys = Array.from(buckets.keys());
  for (const key of keys) {
    const stamps = buckets.get(key);
    if (!stamps || stamps.length === 0 || now - stamps[stamps.length - 1] > 24 * 3600_000) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts.max ?? DEFAULT_MAX;
  const now = Date.now();

  sweep(now);

  const stamps = buckets.get(key) ?? [];
  const fresh = stamps.filter((t) => now - t < windowMs);

  if (fresh.length >= max) {
    const oldest = fresh[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return {
    allowed: true,
    remaining: max - fresh.length,
    retryAfter: Math.ceil(windowMs / 1000),
  };
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfter),
  };
}

/** Best-effort client IP from a Next.js request. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
