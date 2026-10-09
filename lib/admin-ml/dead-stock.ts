/**
 * Dead stock alert — 90+ din se na bikne wale products.
 *
 * Jo product 3 mahine mein 1 unit bhi na bika ho aur uska
 * stock para ho — us mein paisa phansa hua hai. Sab se zyada
 * qeemat wala stock pehle dikhao taake pehle usko nikalo.
 */
import type { Order, Product, WithId } from "../types";
import { productPrice, productStock, salesByProduct } from "./utils";

export interface DeadStockItem {
  productId: string;
  /** kitna stock para hai */
  stock: number;
  /** is stock ki kul qeemat (PKR) — phansa hua paisa */
  stockValue: number;
}

export function deadStock(
  products: WithId<Product>[],
  orders: WithId<Order>[],
  windowDays = 90
): DeadStockItem[] {
  const sales = salesByProduct(orders, windowDays);
  const out: DeadStockItem[] = [];

  for (const p of products) {
    if (!p.published) continue;
    const stock = productStock(p);
    if (stock <= 0) continue;
    if ((sales.get(p.id) ?? 0) > 0) continue; // bik raha hai — dead nahi
    out.push({
      productId: p.id,
      stock,
      stockValue: stock * productPrice(p),
    });
  }
  // sab se zyada phansa paisa pehle
  return out.sort((a, b) => b.stockValue - a.stockValue);
}
