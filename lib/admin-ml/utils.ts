/**
 * Admin ML — shared helpers.
 *
 * Saare admin "AI insights" isi file ke helpers par bante hain:
 * Firestore timestamps ko millis mein badalna, product ka total
 * stock nikalna (variants samet), aur sirf gine-jaane wale orders
 * (cancelled nahi) filter karna.
 */
import type { Order, Product, WithId } from "../types";

export const DAY = 24 * 60 * 60 * 1000;

/** Firestore Timestamp / plain object / number — sab se millis nikalo. */
export function toMillis(t: unknown): number {
  if (t == null) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "object") {
    const ts = t as { toMillis?: () => number; seconds?: number };
    if (typeof ts.toMillis === "function") {
      try {
        return ts.toMillis();
      } catch {
        return 0;
      }
    }
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
  }
  return 0;
}

/** Order dashboard/report mein gina jayega ya nahi. */
export function isCounted(o: Order): boolean {
  return o.status !== "Cancelled";
}

/** Product ka kul stock — variant combinations hon to unka sum, warna base. */
export function productStock(p: Product): number {
  if (p.combinations && p.combinations.length > 0) {
    return p.combinations.reduce((s, c) => s + (c.stock ?? 0), 0);
  }
  return p.baseStock ?? 0;
}

/** Product ki asal selling price (variant ho to sab se sasti). */
export function productPrice(p: Product): number {
  if (p.combinations && p.combinations.length > 0) {
    return Math.min(...p.combinations.map((c) => c.price));
  }
  return p.basePrice ?? 0;
}

/**
 * Pichle N din ke gine-jaane wale orders se product-wise
 * kul quantity ka map. `OrderItem.qty` istemal hota hai.
 */
export function salesByProduct(
  orders: WithId<Order>[],
  windowDays: number
): Map<string, number> {
  const cutoff = Date.now() - windowDays * DAY;
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!isCounted(o)) continue;
    if (toMillis(o.createdAt) < cutoff) continue;
    for (const item of o.items ?? []) {
      const id = item.productId;
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + (item.qty ?? 1));
    }
  }
  return map;
}

/** Pichle N din ke orders se roz ka revenue (aur order count). */
export function dailyRevenue(
  orders: WithId<Order>[],
  windowDays: number
): { date: string; revenue: number; orders: number }[] {
  const days: { date: string; revenue: number; orders: number }[] = [];
  const now = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cutoff = Date.now() - windowDays * DAY;
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const ms = toMillis(o.createdAt);
    if (ms < cutoff) continue;
    const key = new Date(ms).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) {
      bucket.revenue += o.total ?? 0;
      bucket.orders += 1;
    }
  }
  return days;
}

/** Aadad ko "1,250" style mein dikhao (en-PK locale decimal deta hai). */
export function grouped(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
