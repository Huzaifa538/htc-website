/**
 * PRODUCT CARD — STYLE C "Playful" (Ali-approved) + premium 3D effects.
 *
 * Used for EVERY product card on the site (home, shop, related products).
 * Warm beige/cream card, rounded-2xl rectangular image, red pill price
 * badge, big rounded-full brown Add to Cart, wishlist heart top-right,
 * discount % badge, star rating.
 *
 * Effects (compose via nesting — outer tilt, inner flip):
 * - 3D TILT (outer wrapper): card subtly tilts toward the cursor
 *   (rotateX/rotateY, max ~8deg) with a soft glare sweep. Mouse only —
 *   disabled on touch devices and when prefers-reduced-motion.
 * - HOVER ZOOM: image scales to 1.1 on card hover.
 * - QUICK ADD: "Add to Cart" bar slides up over the image on hover
 *   (desktop); always visible on touch.
 * - 3D FLIP (inner): info button flips the card (rotateY 180deg) to reveal
 *   details on the back — short description, key specs, price, Add to
 *   Cart. Flip back via the same button or the back-face buttons.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, Heart, Info, MessageCircle, RotateCcw, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import type { Product, WithId } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers";
import { useLanguage } from "@/lib/i18n";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { useUiStore } from "@/lib/store/ui";
import {
  findCombination,
  getProductPrice,
  primaryImage,
} from "@/components/customer/product-utils";
import { Stars } from "@/components/customer/stars";
import { QuickView } from "@/components/customer/quick-view";
import { WhatsAppOrderButton } from "@/components/customer/whatsapp-order-button";
import { useActiveFlashSale } from "@/components/flash-sale-banner";
import { applyFlashSale } from "@/lib/flash-sale";

const TILT_MAX = 8; // degrees

/** Heart burst particles shown briefly when adding to wishlist. */
function HeartBurst({ show }: { show: boolean }) {
  if (!show) return null;
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return {
      x: Math.cos(angle) * 28,
      y: Math.sin(angle) * 28,
      delay: 0,
    };
  });
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: p.delay }}
          className="absolute h-1.5 w-1.5 rounded-full bg-[#D21F26]"
        />
      ))}
    </span>
  );
}

export function ProductCard({ product }: { product: WithId<Product> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  // Urdu mode mein Urdu naam dikhao agar available ho
  const displayName = lang === "ur" && product.urduName ? product.urduName : product.name;
  const addLine = useCartStore((s) => s.addLine);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wished = useWishlistStore((s) => s.productIds.includes(product.id));
  const openDrawer = useUiStore((s) => s.setCartDrawerOpen);
  const openChat = useChatUiStore((s) => s.openChat);
  const [flipped, setFlipped] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);

  // --- 3D tilt (outer wrapper) ---
  const tiltRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const tiltEnabled = useRef(false);

  useEffect(() => {
    // Mouse-only: skip on touch devices or reduced motion.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tiltEnabled.current = fine && !reduced;
  }, []);

  function applyTilt(rx: number, ry: number, gx: number, gy: number, instant: boolean) {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transition = instant ? "none" : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    const glare = glareRef.current;
    if (glare) {
      glare.style.opacity = instant ? "1" : "0";
      glare.style.background = `radial-gradient(circle at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, rgba(255,255,255,0.28), transparent 60%)`;
    }
  }

  function onTiltMove(e: React.MouseEvent) {
    if (!tiltEnabled.current || flipped) return;
    const el = tiltRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    rafRef.current = requestAnimationFrame(() => {
      applyTilt((0.5 - py) * TILT_MAX, (px - 0.5) * TILT_MAX, px * 100, py * 100, true);
    });
  }

  function onTiltLeave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    applyTilt(0, 0, 50, 50, false);
  }

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const price = getProductPrice(product);
  const href = `/product/${product.slug || product.id}`;
  // Flash sale: show discounted price with strikethrough original.
  const flashSale = useActiveFlashSale();
  const salePrice = flashSale ? applyFlashSale(price.price, flashSale) : price.price;
  const onSale = flashSale != null && salePrice < price.price;
  const hasVariants = product.variantTypes.length > 0;
  const outOfStock = price.stock <= 0;
  // Contact-for-price items: no cart actions, WhatsApp inquiry instead.
  const zeroPrice = price.price <= 0;
  const waHref = `https://wa.me/923212476150?text=${encodeURIComponent(
    t.productCard.inquireAbout(product.name)
  )}`;
  // Missing product photo: render a placeholder block instead of crashing.
  const img = product.images?.[0];

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants || outOfStock || zeroPrice) return;
    const combination =
      product.combinations.length > 0
        ? findCombination(product, {})
        : undefined;
    addLine({
      productId: product.id,
      combinationId: combination?.id,
      variant: combination?.options ?? {},
      name: product.name,
      image: combination?.image ?? primaryImage(product),
      unitPrice: combination?.price ?? price.price,
      stock: combination?.stock ?? price.stock,
    });
    toast.success(t.productCard.addedToCart(product.name));
    openDrawer(true);
  }

  function toggleFlip(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFlipped((f) => !f);
  }

  /** Open the chat with this product attached (routes to the MTR inbox). */
  function handleChatAbout(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error(t.productCard.signInToChat);
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }
    openChat({
      kind: "product",
      id: product.id,
      name: product.name,
      image: primaryImage(product),
      detail: formatPrice(price.price),
      href,
    });
    toast.success(t.productCard.chatOpened);
  }

  const quickAdd = zeroPrice ? (
    <a
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1FA855] px-4 py-2 text-[13px] font-bold text-white shadow-xl transition hover:bg-[#178a44] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
    >
      <MessageCircle size={15} /> {t.productCard.whatsApp}
    </a>
  ) : hasVariants ? (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-[#7C4A21] px-4 py-2 text-[13px] font-bold text-white shadow-xl transition hover:bg-[#5f3a19] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
    >
      <ShoppingCart size={15} /> {t.productCard.selectOptions}
    </Link>
  ) : (
    <button
      onClick={handleAdd}
      disabled={outOfStock}
      className="pointer-events-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-[#7C4A21] px-4 py-2 text-[13px] font-bold text-white shadow-xl transition hover:bg-[#5f3a19] disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
    >
      <ShoppingCart size={15} /> {outOfStock ? t.productCard.outOfStock : t.productCard.addToCart}
    </button>
  );

  return (
    <div className="[perspective:1400px]">
      {/* TILT layer (outer) */}
      <div
        ref={tiltRef}
        onMouseMove={onTiltMove}
        onMouseLeave={onTiltLeave}
        className="relative [transform-style:preserve-3d] will-change-transform"
      >
        <motion.div
          whileHover={{ y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="group relative"
        >
          {/* FLIP layer (inner) */}
          <div
            className={cn(
              "relative transition-transform duration-700 [transform-style:preserve-3d]",
              flipped && "[transform:rotateY(180deg)]"
            )}
          >
            {/* ============ FRONT ============ */}
            <div className="flex flex-col rounded-3xl bg-[#FBF3E4] p-3 shadow-sm transition-shadow hover:shadow-xl [backface-visibility:hidden] dark:bg-stone-900/60 dark:shadow-none dark:ring-1 dark:ring-white/10">
              {/* Image */}
              <div className="relative">
                <Link href={href} aria-label={product.name}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white/60 dark:bg-black/30">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-200/70 dark:bg-black/40">
                        <Image
                          src="/logo.png"
                          alt={product.name}
                          width={72}
                          height={72}
                          className="rounded-xl bg-white p-2 opacity-70"
                        />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Quick add — slides up over the image on hover (desktop);
                    always visible on touch devices */}
                <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center opacity-100 transition-all duration-300 md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  {quickAdd}
                </div>

                {/* Discount badge */}
                {price.discountPct > 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#D21F26] px-2.5 py-1 text-xs font-extrabold text-white shadow">
                    -{price.discountPct}%
                  </span>
                )}

                {/* Info / flip button */}
                <button
                  onClick={toggleFlip}
                  aria-label={flipped ? t.productCard.hideDetails : t.productCard.viewDetails}
                  title={t.productCard.details}
                  className="absolute left-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white dark:bg-black/60 dark:text-stone-200"
                  style={{ top: price.discountPct > 0 ? "3rem" : "0.5rem" }}
                >
                  <Info size={17} />
                </button>

                {/* Wishlist heart — with burst animation */}
                <motion.button
                  key={String(wished)}
                  initial={wished ? { scale: 0.6 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  onClick={() => {
                    toggleWishlist(product.id);
                    if (!wished) {
                      setHeartBurst(true);
                      setTimeout(() => setHeartBurst(false), 550);
                    }
                    toast(wished ? t.productCard.removedFromWishlist : t.productCard.savedToWishlist);
                  }}
                  aria-label={wished ? t.productCard.removeFromWishlist : t.productCard.addToWishlist}
                  className={cn(
                    "absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full shadow transition",
                    wished
                      ? "bg-[#D21F26] text-white"
                      : "bg-white/90 text-stone-700 hover:bg-white dark:bg-black/60 dark:text-stone-200"
                  )}
                >
                  <Heart size={17} className={wished ? "fill-current" : ""} />
                  <HeartBurst show={heartBurst} />
                </motion.button>

                {/* Quick view — opens modal without page navigation */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuickViewOpen(true);
                  }}
                  aria-label={t.productCard.quickView(product.name)}
                  title={t.productCard.quickView(product.name)}
                  className="absolute right-2 top-[3.5rem] flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white dark:bg-black/60 dark:text-stone-200"
                >
                  <Eye size={17} />
                </button>

                {/* Chat about this product — opens the MTR chat with the product attached */}
                <button
                  onClick={handleChatAbout}
                  aria-label={t.productCard.chatAbout(product.name)}
                  title={t.productCard.chatAbout(product.name)}
                  className="absolute right-2 top-[6rem] flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white dark:bg-black/60 dark:text-stone-200"
                >
                  <MessageCircle size={17} />
                </button>

                {outOfStock && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
                    {t.productCard.outOfStockBadge}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3">
                <div className="flex items-center gap-1.5">
                  <Stars rating={product.rating} />
                  <span className="text-xs text-muted-foreground">
                    ({product.reviewCount})
                  </span>
                </div>
                <Link href={href} className="mt-1.5 line-clamp-2 min-h-[2.6em] font-display text-[15px] font-semibold leading-snug hover:text-[#D21F26]">
                  {displayName}
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#D21F26] px-3.5 py-1.5 text-sm font-extrabold text-white shadow-sm">
                    {formatPrice(onSale ? salePrice : price.price)}
                  </span>
                  {onSale ? (
                    <s className="text-sm text-muted-foreground">
                      {formatPrice(price.price)}
                    </s>
                  ) : (
                    price.compareAt && (
                      <s className="text-sm text-muted-foreground">
                        {formatPrice(price.compareAt)}
                      </s>
                    )
                  )}
                </div>

                {zeroPrice ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1FA855] py-2.5 text-sm font-bold text-white transition hover:bg-[#178a44]"
                  >
                    <MessageCircle size={16} /> {t.productCard.whatsAppInquire}
                  </a>
                ) : hasVariants ? (
                  <Link
                    href={href}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-2.5 text-sm font-bold text-white transition hover:bg-[#5f3a19]"
                  >
                    <ShoppingCart size={16} /> {t.productCard.selectOptions}
                  </Link>
                ) : (
                  <button
                    onClick={handleAdd}
                    disabled={outOfStock}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-2.5 text-sm font-bold text-white transition hover:bg-[#5f3a19] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingCart size={16} /> {t.productCard.addToCart}
                  </button>
                )}
                {/* WhatsApp direct order */}
                {!zeroPrice && !outOfStock && (
                  <WhatsAppOrderButton
                    productName={product.name}
                    priceLabel={formatPrice(onSale ? salePrice : price.price)}
                    productUrl={
                      typeof window !== "undefined"
                        ? `${window.location.origin}${href}`
                        : href
                    }
                    size="compact"
                    className="mt-2 w-full"
                  />
                )}
              </div>
            </div>

            {/* ============ BACK (details) ============ */}
            <div className="absolute inset-0 flex flex-col rounded-3xl bg-[#F5E9D3] p-5 shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)] dark:bg-stone-900 dark:ring-1 dark:ring-white/10">
              <button
                onClick={toggleFlip}
                aria-label={t.productCard.backToProduct}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow transition hover:bg-white dark:bg-black/50 dark:text-stone-200"
              >
                <X size={16} />
              </button>

              <p className="pr-8 font-display text-base font-extrabold leading-snug">
                {displayName}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Stars rating={product.rating} />
                <span className="text-xs text-muted-foreground">
                  {product.rating.toFixed(1)} ({product.reviewCount})
                </span>
              </div>

              {product.shortDescription && (
                <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">
                  {product.shortDescription}
                </p>
              )}

              <dl className="mt-3 space-y-1.5 text-[13px]">
                {product.sku && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t.productCard.sku}</dt>
                    <dd className="font-semibold">{product.sku}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t.productCard.availability}</dt>
                  <dd className={cn("font-semibold", outOfStock ? "text-red-600" : "text-emerald-700 dark:text-emerald-400")}>
                    {outOfStock ? t.productCard.outOfStock : t.productCard.inStock(price.stock)}
                  </dd>
                </div>
                {product.soldCount != null && product.soldCount > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t.productCard.soldLabel}</dt>
                    <dd className="font-semibold">{t.productCard.sold(product.soldCount)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-auto pt-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#D21F26] px-3.5 py-1.5 text-sm font-extrabold text-white">
                    {formatPrice(onSale ? salePrice : price.price)}
                  </span>
                  {onSale ? (
                    <s className="text-sm text-muted-foreground">{formatPrice(price.price)}</s>
                  ) : (
                    price.compareAt && (
                      <s className="text-sm text-muted-foreground">{formatPrice(price.compareAt)}</s>
                    )
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  {zeroPrice ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1FA855] py-2.5 text-sm font-bold text-white transition hover:bg-[#178a44]"
                    >
                      <MessageCircle size={15} /> {t.productCard.whatsAppInquire}
                    </a>
                  ) : hasVariants ? (
                    <Link
                      href={href}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-2.5 text-sm font-bold text-white transition hover:bg-[#5f3a19]"
                    >
                      <ShoppingCart size={15} /> {t.productCard.selectOptions}
                    </Link>
                  ) : (
                    <button
                      onClick={handleAdd}
                      disabled={outOfStock}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#7C4A21] py-2.5 text-sm font-bold text-white transition hover:bg-[#5f3a19] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingCart size={15} /> {t.productCard.addToCart}
                    </button>
                  )}
                  <button
                    onClick={toggleFlip}
                    aria-label={t.productCard.backToProduct}
                    className="inline-flex items-center justify-center rounded-full border border-stone-300 px-3.5 text-stone-600 transition hover:border-[#D21F26] hover:text-[#D21F26] dark:border-stone-700 dark:text-stone-300"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Glare sweep */}
        <div
          ref={glareRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300"
        />
      </div>

      {/* Quick view modal */}
      {quickViewOpen && (
        <QuickView product={product} onClose={() => setQuickViewOpen(false)} />
      )}
    </div>
  );
}
