/**
 * Related products — "ye khareedne walon ne ye bhi khareeda".
 *
 * Simple weighted scoring:
 *   same category      x3
 *   similar price      x2
 *   high rating        x1
 */
"use client";

import { useMemo } from "react";
import { ProductCard } from "@/components/customer/product-card";
import { getProductPrice } from "@/components/customer/product-utils";
import { useProducts } from "@/components/customer/data-hooks";
import { useLanguage } from "@/lib/i18n";
import type { Product, WithId } from "@/lib/types";

function score(base: WithId<Product>, other: WithId<Product>): number {
  let s = 0;

  // same category matters most
  if (other.categoryId && other.categoryId === base.categoryId) s += 3;

  // similar price range (within 40%)
  const bp = getProductPrice(base).price;
  const op = getProductPrice(other).price;
  if (bp > 0 && op > 0) {
    const diff = Math.abs(bp - op) / bp;
    if (diff <= 0.4) s += 2 * (1 - diff / 0.4);
  }

  // well-rated products get a small boost
  if (other.rating >= 4) s += 1;
  else if (other.rating >= 3) s += 0.5;

  // popular items (people actually buy these together)
  if (other.soldCount > 20) s += 0.5;

  return s;
}

export function RelatedProducts({
  product,
  limit = 4,
}: {
  product: WithId<Product>;
  limit?: number;
}) {
  const { products } = useProducts();
  const { t } = useLanguage();

  const related = useMemo(() => {
    return products
      .filter((p) => p.id !== product.id && p.published !== false)
      .map((p) => ({ p, s: score(product, p) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((r) => r.p);
  }, [products, product, limit]);

  if (related.length === 0) return null;

  return (
    <div className="mt-14">
      <h2 className="mb-6 font-display text-2xl font-extrabold">
        {t.product.relatedProducts}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
