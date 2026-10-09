/**
 * QuickView: product quick-view modal.
 * Opens from product cards — shows image, name, price, rating,
 * short description, Add to Cart + View Details, without page navigation.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import type { Product, WithId } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useUiStore } from "@/lib/store/ui";
import {
  findCombination,
  getProductPrice,
  primaryImage,
} from "@/components/customer/product-utils";
import { Stars } from "@/components/customer/stars";
import { useLanguage } from "@/lib/i18n";

export function QuickView({
  product,
  onClose,
}: {
  product: WithId<Product> | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const addLine = useCartStore((s) => s.addLine);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wished = useWishlistStore((s) =>
    product ? s.productIds.includes(product.id) : false
  );
  const openDrawer = useUiStore((s) => s.setCartDrawerOpen);

  // Early return AFTER hooks — render AnimatePresence with conditional content
  const price = product ? getProductPrice(product) : null;
  const href = product ? `/product/${product.slug || product.id}` : "/";
  const hasVariants = product ? product.variantTypes.length > 0 : false;
  const outOfStock = price ? price.stock <= 0 : true;
  const zeroPrice = price ? price.price <= 0 : true;
  const img = product ? primaryImage(product) : "";
  const waHref = product
    ? `https://wa.me/923212476150?text=${encodeURIComponent(
        t.productCard.inquireAbout(product.name)
      )}`
    : "#";

  function handleAdd() {
    if (!product || !price) return;
    if (hasVariants || outOfStock || zeroPrice) {
      if (hasVariants) router.push(href);
      return;
    }
    const combination =
      product.combinations.length > 0 ? findCombination(product, {}) : undefined;
    addLine({
      productId: product.id,
      combinationId: combination?.id,
      variant: combination?.options ?? {},
      name: product.name,
      image: combination?.image ?? img,
      unitPrice: combination?.price ?? price.price,
      stock: combination?.stock ?? price.stock,
    });
    toast.success(t.productCard.addedToCart(product.name));
    onClose();
    openDrawer(true);
  }

  function handleWishlist() {
    if (!product) return;
    toggleWishlist(product.id);
    toast(wished ? t.productCard.removedFromWishlist : t.productCard.savedToWishlist);
  }

  return (
    <AnimatePresence>
      {product && price && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-stone-950 md:grid-cols-2"
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label={t.productCard.closeQuickView}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <X size={18} />
            </button>

            {/* Image */}
            <div className="relative aspect-square bg-stone-100 md:aspect-auto md:min-h-[420px] dark:bg-stone-900">
              {img ? (
                <Image
                  src={img}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt={product.name}
                    width={96}
                    height={96}
                    className="rounded-2xl bg-white p-3 opacity-70"
                  />
                </div>
              )}
              {price.discountPct > 0 && (
                <span className="absolute left-3 top-3 rounded-full bg-[#D21F26] px-3 py-1.5 text-sm font-extrabold text-white shadow">
                  -{price.discountPct}%
                </span>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col overflow-y-auto p-6 md:p-8">
              <div className="flex items-center gap-2">
                <Stars rating={product.rating} />
                <span className="text-sm text-muted-foreground">
                  {t.productExtra.ratingReviews(product.rating.toFixed(1), product.reviewCount)}
                </span>
              </div>

              <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight">
                {product.name}
              </h2>

              {product.shortDescription && (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {product.shortDescription}
                </p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-full bg-[#D21F26] px-4 py-2 text-lg font-extrabold text-white">
                  {formatPrice(price.price)}
                </span>
                {price.compareAt && (
                  <s className="text-muted-foreground">
                    {formatPrice(price.compareAt)}
                  </s>
                )}
              </div>

              <p
                className={cn(
                  "mt-3 text-sm font-semibold",
                  outOfStock ? "text-red-600" : "text-emerald-600"
                )}
              >
                {outOfStock
                  ? t.productCard.outOfStock
                  : t.productExtra.inStockAvailable(price.stock)}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                {zeroPrice ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1FA855] py-3 font-bold text-white transition hover:bg-[#178a44]"
                  >
                    <MessageCircle size={17} /> {t.productCard.whatsAppInquire}
                  </a>
                ) : (
                  <button
                    onClick={handleAdd}
                    disabled={outOfStock}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-3 font-bold text-white transition hover:bg-[#5f3a19] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingCart size={17} />
                    {hasVariants
                      ? t.productCard.selectOptions
                      : outOfStock
                        ? t.productCard.outOfStock
                        : t.productCard.addToCart}
                  </button>
                )}
                <div className="flex gap-2.5">
                  <button
                    onClick={handleWishlist}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-full border py-3 font-semibold transition",
                      wished
                        ? "border-[#D21F26] bg-[#D21F26]/10 text-[#D21F26]"
                        : "border-black/10 hover:border-[#D21F26] hover:text-[#D21F26] dark:border-white/15"
                    )}
                  >
                    <Heart
                      size={17}
                      className={wished ? "fill-[#D21F26]" : ""}
                    />
                    {wished ? t.productCard.wishlisted : t.productCard.wishlist}
                  </button>
                  <Link
                    href={href}
                    onClick={onClose}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-black/[0.04] py-3 font-semibold transition hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
                  >
                    {t.productCard.viewDetails}
                  </Link>
                </div>
              </div>

              {product.sku && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t.productCard.sku}: {product.sku}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
