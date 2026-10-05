/**
 * useHydratedCart — cart lines with display fields (name/image/price)
 * re-hydrated from the products catalog (needed for lines restored from
 * Firestore), plus subtotal / coupon discount / shipping / total.
 */
"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/store/cart";
import { useProducts, useSiteSettings } from "@/components/customer/data-hooks";
import { getProductPrice, primaryImage } from "@/components/customer/product-utils";
import { cartTotals, FLAT_SHIPPING, DEFAULT_FREE_SHIPPING_THRESHOLD } from "@/lib/cart-totals";

export { FLAT_SHIPPING, DEFAULT_FREE_SHIPPING_THRESHOLD };

export function useHydratedCart() {
  const lines = useCartStore((s) => s.lines);
  const updateLine = useCartStore((s) => s.updateLine);
  const coupon = useCartStore((s) => s.coupon);
  const { products } = useProducts();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (products.length === 0) return;
    for (const l of lines) {
      if (l.unitPrice > 0 && l.image && l.name !== l.productId) continue;
      const p = products.find((pp) => pp.id === l.productId);
      if (!p) continue;
      const combo = p.combinations.find((c) => c.id === l.combinationId);
      const info = getProductPrice(p);
      updateLine(l.key, {
        name: p.name,
        image: combo?.image ?? primaryImage(p),
        unitPrice: combo?.price ?? info.price,
        stock: combo?.stock ?? info.stock,
      });
    }
  }, [products, lines, updateLine]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const threshold =
    settings?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
  // Single source of truth for the math lives in lib/cart-totals (tested).
  const { discount, shipping, total } = cartTotals(lines, coupon, threshold);

  return { lines, coupon, subtotal, discount, shipping, total, threshold, settings };
}
