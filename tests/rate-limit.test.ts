import { describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to max attempts inside the window, then blocks", () => {
    const key = `t1-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, { windowMs: 60_000, max: 5 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const blocked = checkRateLimit(key, { windowMs: 60_000, max: 5 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks different keys independently", () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(a, { windowMs: 60_000, max: 3 });
    expect(checkRateLimit(a, { windowMs: 60_000, max: 3 }).allowed).toBe(false);
    expect(checkRateLimit(b, { windowMs: 60_000, max: 3 }).allowed).toBe(true);
  });

  it("forgets old attempts outside the window", async () => {
    const key = `w-${Date.now()}`;
    checkRateLimit(key, { windowMs: 5, max: 1 });
    expect(checkRateLimit(key, { windowMs: 5, max: 1 }).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 10)); // let the window expire
    expect(checkRateLimit(key, { windowMs: 5, max: 1 }).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for's first entry", () => {
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    const req = new Request("https://x.test", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
    expect(getClientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
