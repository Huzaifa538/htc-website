/**
 * Stock demand forecast — simple trend from sales history.
 *
 * Har product ke liye: pichle orders se average daily sales nikalo,
 * us se andaza lagao ke maujooda stock kitne din chalega.
 * Data kam ho to category average use hoti hai.
 */
import type { Order, OrderItem, Product, WithId } from "./types";
import { getProductPrice } from "@/components/customer/product-utils";

export interface Forecast {
  productId: string;
  /** andazan roz kitne units bikte hain */
  dailySales: number;
  /** maujooda stock kitne din chalega */
  daysOfStock: number;
  /** low / ok / healthy */
  status: "low" | "ok" | "healthy";
  /** kitna stock aur mangwana chahiye (30 din ke liye) */
  suggestedReorder: number;
}

const DAY = 24 * 60 * 60 * 1000;

function toMillis(t: unknown): number {
  if (!t || typeof t !== "object") return 0;
  const ts = t as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === "function") {
    try {
      return ts.toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/** pichle N din ke orders se product-wise total quantity */
function salesByProduct(orders: WithId<Order>[], days: number): Map<string, number> {
  const cutoff = Date.now() - days * DAY;
  const map = new Map<string, number>();
  for (const o of orders) {
    if (toMillis(o.createdAt) < cutoff) continue;
    if (o.status === "Cancelled") continue;
    for (const item of o.items as OrderItem[]) {
      const id = item.productId;
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + (item.qty ?? 1));
    }
  }
  return map;
}

/**
 * Har product ka forecast banao.
 * `windowDays` = kitne din ka history dekhen (default 30).
 */
export function forecastDemand(
  products: WithId<Product>[],
  orders: WithId<Order>[],
  windowDays = 30
): Forecast[] {
  const sales = salesByProduct(orders, windowDays);

  // category average — jahan product ka apna data na ho
  const catSales = new Map<string, { total: number; count: number }>();
  for (const p of products) {
    const qty = sales.get(p.id) ?? 0;
    const c = catSales.get(p.categoryId) ?? { total: 0, count: 0 };
    c.total += qty;
    c.count += 1;
    catSales.set(p.categoryId, c);
  }

  return products.map((p) => {
    let qty = sales.get(p.id) ?? 0;
    if (qty === 0) {
      // apna data nahi — category average le lo
      const c = catSales.get(p.categoryId);
      qty = c && c.count > 0 ? c.total / c.count : 0;
    }
    const dailySales = qty / windowDays;
    const stock = getProductPrice(p).stock;
    const daysOfStock = dailySales > 0 ? stock / dailySales : 999;

    const status: Forecast["status"] =
      daysOfStock < 14 ? "low" : daysOfStock < 45 ? "ok" : "healthy";

    // 30 din ka stock pura karne ke liye kitna chahiye
    const suggestedReorder = Math.max(0, Math.ceil(dailySales * 30 - stock));

    return { productId: p.id, dailySales, daysOfStock, status, suggestedReorder };
  });
}
