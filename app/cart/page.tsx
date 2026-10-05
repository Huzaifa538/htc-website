/**
 * /cart — variant lines, qty update, remove, coupon code (coupons
 * collection), order summary.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Minus, Plus, ShoppingCart, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { limit, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/lib/store/cart";
import { useHydratedCart } from "@/components/customer/use-hydrated-cart";
import { fetchCollection } from "@/components/customer/data-hooks";
import { tsMillis } from "@/components/customer/product-utils";
import { formatPKR } from "@/lib/format";
import type { Coupon } from "@/lib/types";

export default function CartPage() {
  const { lines, coupon, subtotal, discount, shipping, total, threshold } =
    useHydratedCart();
  const updateQty = useCartStore((s) => s.updateQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const setCoupon = useCartStore((s) => s.setCoupon);

  const [code, setCode] = useState(coupon?.code ?? "");
  const [couponBusy, setCouponBusy] = useState(false);

  async function applyCoupon() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    if (!db || !isFirebaseConfigured()) {
      toast.error("Coupons are unavailable right now");
      return;
    }
    setCouponBusy(true);
    try {
      const rows = await fetchCollection<Coupon>(
        COLLECTIONS.coupons,
        where("code", "==", value),
        limit(1)
      );
      const c = rows[0];
      if (!c || !c.enabled) {
        toast.error("Invalid coupon code");
        return;
      }
      if (c.expiresAt && tsMillis(c.expiresAt) < Date.now()) {
        toast.error("This coupon has expired");
        return;
      }
      if (c.maxUses != null && c.usedCount >= c.maxUses) {
        toast.error("This coupon has reached its usage limit");
        return;
      }
      if (c.minOrder != null && subtotal < c.minOrder) {
        toast.error(`Minimum order of ${formatPKR(c.minOrder)} required`);
        return;
      }
      setCoupon({ code: c.code, type: c.type, value: c.value });
      toast.success(
        c.type === "percent"
          ? `${c.value}% discount applied`
          : `${formatPKR(c.value)} discount applied`
      );
    } catch {
      toast.error("Could not validate coupon — please try again.");
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            <ShoppingCart className="text-[#D21F26]" /> Your Cart
          </h1>
        </Reveal>

        {lines.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Your cart is empty"
              description="Beautiful handcrafted furniture is waiting for you."
              actionLabel="Start Shopping"
              actionHref="/shop"
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            {/* Lines */}
            <ul className="space-y-4">
              {lines.map((l) => (
                <motion.li
                  key={l.key}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 rounded-3xl border bg-card p-4"
                >
                  <Link
                    href={`/product/${l.productId}`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-28"
                  >
                    <Image
                      src={l.image || "/logo.png"}
                      alt={l.name}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${l.productId}`}
                        className="font-display font-bold hover:text-[#D21F26]"
                      >
                        {l.name === l.productId ? "Loading…" : l.name}
                      </Link>
                      <button
                        onClick={() => {
                          removeLine(l.key);
                          toast("Item removed");
                        }}
                        aria-label="Remove item"
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {Object.keys(l.variant).length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(l.variant)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border px-1.5 py-1">
                        <button
                          onClick={() => updateQty(l.key, l.qty - 1)}
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 text-center font-extrabold">{l.qty}</span>
                        <button
                          onClick={() => updateQty(l.key, l.qty + 1)}
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="font-display text-lg font-extrabold text-[#D21F26]">
                        {formatPKR(l.unitPrice * l.qty)}
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>

            {/* Summary */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border bg-card p-6">
                <h2 className="font-display text-lg font-extrabold">Order Summary</h2>

                {/* Coupon */}
                {coupon ? (
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3 dark:bg-green-950">
                    <span className="flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-300">
                      <Tag size={15} /> {coupon.code}
                    </span>
                    <button
                      onClick={() => {
                        setCoupon(null);
                        setCode("");
                      }}
                      aria-label="Remove coupon"
                      className="rounded-full p-1 hover:bg-green-100 dark:hover:bg-green-900"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Coupon code"
                      className="rounded-xl uppercase"
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    />
                    <Button
                      onClick={applyCoupon}
                      disabled={couponBusy || !code.trim()}
                      className="shrink-0 rounded-xl bg-stone-900 hover:bg-stone-700"
                    >
                      {couponBusy ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}

                <dl className="mt-5 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-bold">{formatPKR(subtotal)}</dd>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <dt>Coupon discount</dt>
                      <dd className="font-bold">−{formatPKR(discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="font-bold">
                      {shipping === 0 ? (
                        <span className="text-green-600 dark:text-green-400">FREE</span>
                      ) : (
                        formatPKR(shipping)
                      )}
                    </dd>
                  </div>
                  {shipping > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add {formatPKR(threshold - (subtotal - discount))} more for free
                      shipping.
                    </p>
                  )}
                  <div className="flex justify-between border-t pt-3 text-base">
                    <dt className="font-display font-extrabold">Total</dt>
                    <dd className="font-display text-xl font-extrabold text-[#D21F26]">
                      {formatPKR(total)}
                    </dd>
                  </div>
                </dl>

                <Button
                  asChild
                  className="mt-5 w-full rounded-full bg-[#D21F26] py-6 text-base font-bold hover:bg-[#a8161c]"
                >
                  <Link href="/checkout">
                    Proceed to Checkout <ArrowRight size={18} />
                  </Link>
                </Button>
                <Link
                  href="/shop"
                  className="mt-3 block text-center text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
