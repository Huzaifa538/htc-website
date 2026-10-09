/**
 * /combos — Combo Deals: curated product bundles at a bundle price.
 *
 * Each combo shows its included products, the summed regular total vs
 * the bundle price (with savings highlighted), and an "Add all to cart"
 * button that drops every in-stock item in at once.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Gift, Package, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal, SectionHeading } from "@/components/customer/reveal";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { useCollection } from "@/components/admin/firebase";
import { useProducts } from "@/components/customer/data-hooks";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Combo, Product, WithId } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { getProductPrice, primaryImage } from "@/components/customer/product-utils";
import { useCartStore } from "@/lib/store/cart";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

function ComboCard({ combo, products }: { combo: WithId<Combo>; products: WithId<Product>[] }) {
  const { t } = useLanguage();
  const addLine = useCartStore((s) => s.addLine);
  const openDrawer = useUiStore((s) => s.setCartDrawerOpen);

  const items = combo.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is WithId<Product> => !!p);

  const regularTotal = items.reduce((sum, p) => sum + getProductPrice(p).price, 0);
  const savings = Math.max(0, regularTotal - combo.bundlePrice);
  const savingsPct = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

  function addAll() {
    let added = 0;
    for (const p of items) {
      const price = getProductPrice(p);
      if (price.stock <= 0 || price.price <= 0) continue;
      addLine({
        productId: p.id,
        variant: {},
        name: p.name,
        image: primaryImage(p),
        unitPrice: price.price,
        stock: price.stock,
      });
      added++;
    }
    if (added === 0) {
      toast.error(t.combos.itemsOutOfStock);
      return;
    }
    // Note: bundle discount is applied as a note — the cart keeps item
    // prices; the owner honors the bundle price on WhatsApp/checkout.
    toast.success(t.combos.addedToCart(combo.title, added));
    openDrawer(true);
  }

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="overflow-hidden rounded-3xl bg-[#FBF3E4] shadow-sm transition-shadow hover:shadow-xl dark:bg-stone-900/60 dark:ring-1 dark:ring-white/10"
    >
      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#7C4A21] to-[#5f3a19] px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
            <Gift size={22} />
          </span>
          <div>
            <h3 className="font-display text-xl font-extrabold text-white">{combo.title}</h3>
            {savingsPct > 0 && (
              <span className="mt-0.5 inline-block rounded-full bg-[#D21F26] px-2.5 py-0.5 text-xs font-extrabold text-white">
                {t.combos.save(savingsPct)}
              </span>
            )}
          </div>
        </div>
        {combo.description && (
          <p className="mt-2 text-sm text-white/80">{combo.description}</p>
        )}
      </div>

      {/* Included products */}
      <ul className="space-y-3 px-6 py-5">
        {items.map((p) => {
          const price = getProductPrice(p);
          const out = price.stock <= 0;
          return (
            <li key={p.id}>
              <Link
                href={`/product/${p.slug || p.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white/70 p-2.5 transition hover:bg-white dark:bg-black/30 dark:hover:bg-black/50"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                  {p.images?.[0] ? (
                    <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-stone-400">
                      <Package size={20} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className={cn("text-xs", out ? "text-red-600 font-bold" : "text-muted-foreground")}>
                    {out ? t.combos.outOfStock : formatPrice(price.price)}
                  </span>
                </span>
                <Check size={16} className="shrink-0 text-emerald-600" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Pricing + CTA */}
      <div className="border-t border-stone-200/70 px-6 py-5 dark:border-white/10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.combos.bundlePrice}
            </p>
            <p className="font-display text-3xl font-extrabold text-[#D21F26]">
              {formatPrice(combo.bundlePrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t.combos.regularTotal}</p>
            <s className="text-lg font-semibold text-muted-foreground">
              {formatPrice(regularTotal)}
            </s>
            {savings > 0 && (
              <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                {t.combos.youSave(formatPrice(savings))}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={addAll}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[#5f3a19] active:scale-[0.98]"
        >
          <ShoppingCart size={18} /> {t.combos.addAllToCart}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t.combos.bundleNote}
        </p>
      </div>
    </motion.article>
  );
}

export default function CombosPage() {
  const { t } = useLanguage();
  const { data: combos, loading: combosLoading } = useCollection<Combo>(COLLECTIONS.combos);
  const { products, loading: productsLoading } = useProducts();

  const loading = combosLoading || productsLoading;
  const visible = (combos ?? [])
    .filter((c) => c.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <SectionHeading
            eyebrow={t.combos.eyebrow}
            title={t.combos.title}
            subtitle={t.combos.subtitle}
          />
        </Reveal>

        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t.combos.emptyTitle}
            description={t.combos.emptySub}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((combo, i) => (
              <Reveal key={combo.id} delay={i * 0.06}>
                <ComboCard combo={combo} products={products ?? []} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
