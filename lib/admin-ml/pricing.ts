/**
 * Price suggestions — demand aur stock dekh kar mashwara.
 *
 * - Zyada demand + kam stock = price thodi barhao (margin banao)
 * - Kam demand + zyada stock = discount lagao (stock nikalo)
 * - Pehle se discount chal raha ho to dobara mashwara nahi
 */
import type { Order, Product, WithId } from "../types";
import { productPrice, productStock, salesByProduct } from "./utils";

export interface PriceSuggestion {
  productId: string;
  kind: "raise" | "discount";
  /** maujooda price (PKR) */
  currentPrice: number;
  /** tajweez kardah price (PKR) */
  suggestedPrice: number;
  /** kitne % ka farq */
  pct: number;
  reason: string;
}

export function priceSuggestions(
  products: WithId<Product>[],
  orders: WithId<Order>[],
  windowDays = 30
): PriceSuggestion[] {
  const sales = salesByProduct(orders, windowDays);
  const out: PriceSuggestion[] = [];

  for (const p of products) {
    if (!p.published) continue;
    const price = productPrice(p);
    if (price <= 0) continue;
    const stock = productStock(p);
    const qty = sales.get(p.id) ?? 0;
    const dailySales = qty / windowDays;
    const daysOfStock = dailySales > 0 ? stock / dailySales : 999;
    const hasDiscount =
      (p.baseCompareAtPrice ?? 0) > price ||
      p.combinations?.some((c) => (c.compareAtPrice ?? 0) > c.price);

    if (hasDiscount) continue; // pehle hi offer chal rahi hai

    // demand tez, stock jald khatam — price barhao
    if (dailySales > 0 && daysOfStock < 21 && qty >= 5) {
      const suggestedPrice = Math.round(price * 1.07);
      out.push({
        productId: p.id,
        kind: "raise",
        currentPrice: price,
        suggestedPrice,
        pct: 7,
        reason: `Tez bik raha hai (~${daysOfStock < 1 ? "<1" : Math.round(daysOfStock)} din ka stock)`,
      });
      continue;
    }

    // sust bik raha, stock bhara para — discount lagao
    if (stock >= 20 && (dailySales < 0.15 || daysOfStock > 150)) {
      const suggestedPrice = Math.round(price * 0.88);
      out.push({
        productId: p.id,
        kind: "discount",
        currentPrice: price,
        suggestedPrice,
        pct: -12,
        reason:
          dailySales < 0.15
            ? `Sust sale (${qty} units / ${windowDays} din), stock ${stock}`
            : `Stock bahut zyada (~${Math.round(daysOfStock)} din ka)`,
      });
    }
  }

  // pehle wo jahan farq sab se bara ho (PKR mein)
  return out.sort(
    (a, b) =>
      Math.abs(b.suggestedPrice - b.currentPrice) -
      Math.abs(a.suggestedPrice - a.currentPrice)
  );
}
