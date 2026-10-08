/**
 * Flash-sale helpers (client-safe).
 *
 * A flash sale is active when: enabled && startsAt <= now <= endsAt.
 * The storefront shows one banner at a time — the active sale ending
 * soonest. Prices are discounted client-side for display; checkout
 * totals stay server-driven (coupons), so this is a display treatment.
 */
import type { FlashSale, WithId } from "./types";

function tsMillis(t: unknown): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  const maybe = t as { toMillis?: () => number; seconds?: number };
  if (typeof maybe.toMillis === "function") return maybe.toMillis();
  if (typeof maybe.seconds === "number") return maybe.seconds * 1000;
  return 0;
}

export function isFlashSaleActive(sale: WithId<FlashSale>, now = Date.now()): boolean {
  if (!sale.enabled) return false;
  const start = tsMillis(sale.startsAt);
  const end = tsMillis(sale.endsAt);
  return start <= now && now <= end;
}

/** The one sale to show: active, ending soonest. Null when none. */
export function pickActiveFlashSale(
  sales: WithId<FlashSale>[],
  now = Date.now()
): WithId<FlashSale> | null {
  const active = sales.filter((s) => isFlashSaleActive(s, now));
  if (active.length === 0) return null;
  active.sort((a, b) => tsMillis(a.endsAt) - tsMillis(b.endsAt));
  return active[0];
}

/** Discounted price, rounded to whole rupees. */
export function applyFlashSale(price: number, sale: WithId<FlashSale> | null): number {
  if (!sale || price <= 0) return price;
  const pct = Math.min(Math.max(sale.discountPct, 0), 90);
  return Math.round(price * (1 - pct / 100));
}

/** Does this sale cover the product's category? Empty categoryIds = all. */
export function saleCoversCategory(
  sale: WithId<FlashSale>,
  categoryId?: string
): boolean {
  const ids = sale.categoryIds ?? [];
  if (ids.length === 0) return true;
  return !!categoryId && ids.includes(categoryId);
}

/** Split ms into HH / MM / SS strings for the countdown. */
export function splitCountdown(ms: number): { hh: string; mm: string; ss: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { hh, mm, ss };
}

export { tsMillis };
