/**
 * Auto reorder alerts — wo products jo jald khatam hone wale hain.
 *
 * Har product ki pichle 30 din ki average daily sales nikalo;
 * maujooda stock us hisaab se kitne din chalega — 21 din se kam
 * ho to alert. Jahan product ka apna data na ho wahan category
 * ka average istemal hota hai.
 */
import type { Order, Product, WithId } from "../types";
import { productStock, salesByProduct } from "./utils";

export interface ReorderAlert {
  productId: string;
  /** roz andazan kitne units bikte hain */
  dailySales: number;
  /** stock kitne din chalega */
  daysOfStock: number;
  /** 30 din ka stock pura karne ke liye kitne aur chahiye */
  suggestedReorder: number;
}

export function reorderAlerts(
  products: WithId<Product>[],
  orders: WithId<Order>[],
  windowDays = 30,
  lowDays = 21
): ReorderAlert[] {
  const sales = salesByProduct(orders, windowDays);

  // category average — jahan product ka apna data na ho
  const catAvg = new Map<string, { total: number; count: number }>();
  for (const p of products) {
    const c = catAvg.get(p.categoryId) ?? { total: 0, count: 0 };
    c.total += sales.get(p.id) ?? 0;
    c.count += 1;
    catAvg.set(p.categoryId, c);
  }

  const alerts: ReorderAlert[] = [];
  for (const p of products) {
    if (!p.published) continue;
    let qty = sales.get(p.id) ?? 0;
    if (qty === 0) {
      const c = catAvg.get(p.categoryId);
      qty = c && c.count > 0 ? c.total / c.count : 0;
    }
    const dailySales = qty / windowDays;
    const stock = productStock(p);
    if (dailySales <= 0) continue;
    const daysOfStock = stock / dailySales;
    if (daysOfStock < lowDays) {
      alerts.push({
        productId: p.id,
        dailySales,
        daysOfStock,
        suggestedReorder: Math.max(0, Math.ceil(dailySales * 30 - stock)),
      });
    }
  }
  return alerts.sort((a, b) => a.daysOfStock - b.daysOfStock);
}
