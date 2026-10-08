/**
 * /checkout — login required; address form (react-hook-form + zod),
 * COD + online-payment placeholder; creates an `orders` doc with status
 * Pending, then redirects to the confirmation page.
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  doc,
  getDoc,
  increment,
  limit,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Banknote,
  Building2,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/store/cart";
import { useHydratedCart } from "@/components/customer/use-hydrated-cart";
import { fetchCollection } from "@/components/customer/data-hooks";
import { notifyOwnerOrder } from "@/lib/whatsapp";
import { formatPKR } from "@/lib/format";
import { useLanguage, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AppUser, Coupon, OrderAddress, OrderItem, PaymentMethod } from "@/lib/types";

const addressSchema = z.object({
  name: z.string().min(3, "Please enter your full name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  address: z.string().min(10, "Please enter your complete street address"),
  city: z.string().min(2, "Please enter your city"),
  notes: z.string().optional(),
});

type AddressForm = z.infer<typeof addressSchema>;

const PAYMENT_METHODS: { value: PaymentMethod; icon: typeof Banknote }[] = [
  { value: "COD", icon: Banknote },
  { value: "BankTransfer", icon: Building2 },
  { value: "Card", icon: CreditCard },
];

function paymentMeta(t: Dictionary, value: PaymentMethod): { label: string; desc: string } {
  switch (value) {
    case "COD":
      return { label: t.checkout.cod, desc: t.checkout.codDesc };
    case "BankTransfer":
      return { label: t.checkout.bankTransfer, desc: t.checkout.bankTransferDesc };
    case "Card":
      return { label: t.checkout.card, desc: t.checkout.cardDesc };
  }
}

function CheckoutPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { lines, coupon, subtotal, discount, shipping, total } = useHydratedCart();
  const clearCart = useCartStore((s) => s.clearCart);

  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [placing, setPlacing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });

  // Login required.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  // Prefill address from the user's saved profile.
  useEffect(() => {
    if (!db || !user) return;
    getDoc(doc(db, COLLECTIONS.users, user.uid))
      .then((snap) => {
        if (!snap.exists()) return;
        const u = snap.data() as AppUser;
        const a = u.addresses?.[0];
        if (a) {
          setValue("name", a.name);
          setValue("phone", a.phone);
          setValue("address", a.address);
          setValue("city", a.city);
        } else {
          if (user.displayName) setValue("name", user.displayName);
        }
      })
      .catch(() => undefined);
  }, [user, setValue]);

  async function onSubmit(data: AddressForm) {
    if (!user || !db || lines.length === 0 || placing) return;
    setPlacing(true);
    try {
      const address: OrderAddress = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
      };
      const items: OrderItem[] = lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        variant: l.variant,
        price: l.unitPrice,
        qty: l.qty,
        image: l.image,
      }));
      // Order creation is server-side (POST /api/orders): the API re-prices
      // every line from the catalog and re-validates the coupon, so client
      // totals are never trusted.
      const idToken = await user.getIdToken();
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          items: lines.map((l) => ({
            productId: l.productId,
            ...(l.combinationId ? { combinationId: l.combinationId } : {}),
            variant: l.variant,
            qty: l.qty,
          })),
          address,
          paymentMethod: payment,
          ...(coupon ? { couponCode: coupon.code } : {}),
          ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
        }),
      });
      const orderResult = (await orderRes.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        total?: number;
        error?: string;
        details?: { path: string; message: string }[];
      } | null;
      if (!orderRes.ok || !orderResult?.ok || !orderResult.id) {
        const detail = orderResult?.details?.[0]?.message;
        throw new Error(detail || orderResult?.error || "order-failed");
      }
      const orderId = orderResult.id;
      // Server-computed total (re-priced); falls back to the client estimate.
      const placedTotal =
        typeof orderResult.total === "number" ? orderResult.total : total;

      // Owner WhatsApp alert — non-blocking, must never fail checkout.
      // When WhatsApp isn't configured, the API route stores an admin
      // notification instead, so the alert is never lost.
      try {
        void notifyOwnerOrder({
          id: orderId,
          items: items.map((i) => ({ name: i.name, qty: i.qty })),
          total: placedTotal,
          paymentMethod: payment,
          customerName: address.name,
          customerPhone: address.phone,
        });
      } catch {
        /* non-fatal */
      }

      // Bump coupon usage.
      if (coupon && isFirebaseConfigured()) {
        try {
          const rows = await fetchCollection<Coupon>(
            COLLECTIONS.coupons,
            where("code", "==", coupon.code),
            limit(1)
          );
          if (rows[0]) {
            await updateDoc(doc(db, COLLECTIONS.coupons, rows[0].id), {
              usedCount: increment(1),
            });
          }
        } catch {
          /* non-fatal */
        }
      }

      // Save the address to the profile for next time.
      try {
        const uref = doc(db, COLLECTIONS.users, user.uid);
        const snap = await getDoc(uref);
        const existing = snap.exists()
          ? ((snap.data() as AppUser).addresses ?? [])
          : [];
        const already = existing.some(
          (a) => a.address === address.address && a.phone === address.phone
        );
        if (!already) {
          await setDoc(
            uref,
            {
              email: user.email ?? "",
              name: data.name.trim(),
              addresses: [...existing, address].slice(-5),
            },
            { merge: true }
          );
        }
      } catch {
        /* non-fatal */
      }

      clearCart();
      router.replace(`/checkout/success?orderId=${orderId}`);
    } catch {
      toast.error(t.checkout.orderFailed);
      setPlacing(false);
    }
  }

  if (authLoading) {
    return (
      <SiteShell>
        <div className="container flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#D21F26]" size={36} />
        </div>
      </SiteShell>
    );
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Sign in required"
            description="Please sign in to complete your checkout."
            actionLabel="Sign In"
            actionHref="/login?next=/checkout"
          />
        </div>
      </SiteShell>
    );
  }

  if (lines.length === 0) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Your cart is empty"
            description="Add some furniture before checking out."
            actionLabel="Browse Shop"
            actionHref="/shop"
          />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            <Lock className="text-[#D21F26]" size={28} /> Checkout
          </h1>
          <p className="mt-2 text-muted-foreground">
            Almost there — confirm your delivery details.
          </p>
        </Reveal>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* Address */}
            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
                <MapPin size={20} className="text-[#D21F26]" /> Delivery Address
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full name</Label>
                  <Input {...register("name")} placeholder="Muhammad Ali" className="mt-1.5 rounded-xl" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input {...register("phone")} placeholder="03xx xxxxxxx" className="mt-1.5 rounded-xl" />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label>Street address</Label>
                  <Textarea
                    {...register("address")}
                    placeholder="House, street, area…"
                    rows={2}
                    className="mt-1.5 rounded-xl"
                  />
                  {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
                </div>
                <div>
                  <Label>City</Label>
                  <Input {...register("city")} placeholder="Lahore" className="mt-1.5 rounded-xl" />
                  {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city.message}</p>}
                </div>
                <div>
                  <Label>Order notes (optional)</Label>
                  <Input {...register("notes")} placeholder="Any special instructions" className="mt-1.5 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="font-display text-xl font-extrabold">Payment Method</h2>
              <div className="mt-5 space-y-3">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPayment(m.value)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition",
                      payment === m.value
                        ? "border-[#D21F26] bg-[#D21F26]/5"
                        : "border-muted hover:border-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        payment === m.value
                          ? "bg-[#D21F26] text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <m.icon size={20} />
                    </span>
                    <span>
                      <span className="flex items-center gap-2 font-bold">
                        {paymentMeta(t, m.value).label}
                        {m.value === "COD" && (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {paymentMeta(t, m.value).desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {payment !== "COD" && (
                <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Online payments are handled manually for now — our team will
                  call you within 24 hours to complete the payment securely.
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border bg-card p-6">
              <h2 className="font-display text-lg font-extrabold">Your Order</h2>
              <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={l.image || "/logo.png"}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                      <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-1 text-[10px] font-bold text-white">
                        {l.qty}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPKR(l.unitPrice)} each
                      </span>
                    </span>
                    <span className="text-sm font-bold">
                      {formatPKR(l.unitPrice * l.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-2.5 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-bold">{formatPKR(subtotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <dt>Discount{coupon ? ` (${coupon.code})` : ""}</dt>
                    <dd className="font-bold">−{formatPKR(discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="font-bold">
                    {shipping === 0 ? "FREE" : formatPKR(shipping)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-3 text-base">
                  <dt className="font-display font-extrabold">Total</dt>
                  <dd className="font-display text-xl font-extrabold text-[#D21F26]">
                    {formatPKR(total)}
                  </dd>
                </div>
              </dl>
              <Button
                type="submit"
                disabled={placing}
                className="mt-5 w-full rounded-full bg-[#D21F26] py-6 text-base font-bold hover:bg-[#a8161c]"
              >
                {placing ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" /> Placing order…
                  </>
                ) : (
                  <>Place Order · {formatPKR(total)}</>
                )}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                By placing this order you agree to our{" "}
                <a href="/terms" className="underline">Terms</a> and{" "}
                <a href="/refunds" className="underline">Refund Policy</a>.
              </p>
            </div>
          </div>
        </form>
      </div>
    </SiteShell>
  );
}

/** Per-section boundary: a checkout crash never whitescreens the page. */
export default function CheckoutPage() {
  return (
    <ErrorBoundary section="Checkout">
      <CheckoutPageContent />
    </ErrorBoundary>
  );
}
