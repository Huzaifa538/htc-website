/**
 * Festival-sale helpers (client-safe).
 *
 * Flash sale wala hi pattern: enabled && startsAt <= now <= endsAt.
 * Dono active hon to customer ko zyada discount wali milti hai.
 */
import type { FestivalSale, WithId } from "./types";

function tsMillis(t: unknown): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  const maybe = t as { toMillis?: () => number; seconds?: number };
  if (typeof maybe.toMillis === "function") return maybe.toMillis();
  if (typeof maybe.seconds === "number") return maybe.seconds * 1000;
  return 0;
}

export function isFestivalSaleActive(sale: WithId<FestivalSale>, now = Date.now()): boolean {
  if (!sale.enabled) return false;
  const start = tsMillis(sale.startsAt);
  const end = tsMillis(sale.endsAt);
  return start <= now && now <= end;
}

/** Active festival sale jo sab se pehle khatam ho rahi ho. */
export function pickActiveFestivalSale(
  sales: WithId<FestivalSale>[],
  now = Date.now()
): WithId<FestivalSale> | null {
  const active = sales.filter((s) => isFestivalSaleActive(s, now));
  if (active.length === 0) return null;
  active.sort((a, b) => tsMillis(a.endsAt) - tsMillis(b.endsAt));
  return active[0];
}

/** Discounted price, rounded to whole rupees. */
export function applyFestivalSale(price: number, sale: WithId<FestivalSale> | null): number {
  if (!sale) return price;
  return Math.round(price * (1 - sale.discountPct / 100));
}
