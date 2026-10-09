/**
 * /wishlist — saved products.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Product, WithId } from "@/lib/types";
import { SiteShell } from "@/components/customer/site-shell";
import { ProductCard } from "@/components/customer/product-card";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { useLanguage } from "@/lib/i18n";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useProducts } from "@/components/customer/data-hooks";

export default function WishlistPage() {
  const { t } = useLanguage();
  const productIds = useWishlistStore((s) => s.productIds);
  const { products, loading } = useProducts();
  // Fallback: fetch wishlisted products directly by document id, in case an
  // id is missing from the published-products list (unpublished, or a query
  // edge case). Without this the page can show "0 saved items" while the
  // header badge correctly shows items in the store.
  const [direct, setDirect] = useState<WithId<Product>[]>([]);

  useEffect(() => {
    if (loading || !isFirebaseConfigured()) return;
    const fdb = db;
    if (!fdb) return;
    const missing = productIds.filter((id) => !products.some((p) => p.id === id));
    if (missing.length === 0) {
      setDirect([]);
      return;
    }
    let cancelled = false;
    Promise.all(missing.map((id) => getDoc(doc(fdb, COLLECTIONS.products, id))))
      .then((snaps) => {
        if (cancelled) return;
        setDirect(
          snaps
            .filter((s) => s.exists())
            .map((s) => ({ ...(s.data() as Omit<Product, "id">), id: s.id }))
        );
      })
      .catch(() => {
        if (!cancelled) setDirect([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, productIds, products]);

  const items = [
    ...products.filter((p) => productIds.includes(p.id)),
    ...direct.filter((d) => !products.some((p) => p.id === d.id)),
  ];

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            <Heart className="fill-[#D21F26] text-[#D21F26]" /> {t.wishlist.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t.wishlist.savedItems(items.length)}
          </p>
        </Reveal>

        <div className="mt-8">
          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t.wishlist.emptyTitle}
              description={t.wishlist.emptySub}
              actionLabel={t.wishlist.discover}
              actionHref="/shop"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
            >
              {t.wishlist.keepExploring}
            </Link>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
