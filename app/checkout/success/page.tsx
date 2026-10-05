/**
 * /checkout/success — order confirmation page.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { SiteShell } from "@/components/customer/site-shell";
import { OrderTimeline, StatusBadge } from "@/components/customer/order-timeline";
import { EmptyState } from "@/components/customer/skeletons";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/format";
import type { Order, WithId } from "@/lib/types";

function SuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orderId = searchParams.get("orderId") ?? "";
  const [order, setOrder] = useState<WithId<Order> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/checkout");
      return;
    }
    if (!orderId || !db || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, COLLECTIONS.orders, orderId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Order, "id">;
          const o: WithId<Order> = { ...data, id: snap.id };
          setOrder(o.userId === user.uid ? o : null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authLoading, user, orderId, router]);

  if (loading || authLoading) {
    return (
      <SiteShell>
        <div className="container flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#D21F26]" size={36} />
        </div>
      </SiteShell>
    );
  }

  if (!order) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Order not found"
            description="We couldn't find that order. It may belong to a different account."
            actionLabel="My Orders"
            actionHref="/orders"
          />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container max-w-3xl py-12">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="text-center"
        >
          <CheckCircle2 size={72} className="mx-auto text-green-600" />
          <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
            Shukriya! Order placed successfully
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Our team will call <strong>{order.address.phone}</strong> shortly to
            confirm your order. Order ID:{" "}
            <span className="font-mono font-bold text-foreground">{order.id.slice(0, 8)}</span>
          </p>
        </motion.div>

        <div className="mt-10 rounded-3xl border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Package size={19} className="text-[#D21F26]" /> Order Status
            </h2>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-6">
            <OrderTimeline status={order.status} />
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-card p-6 sm:p-8">
          <h2 className="font-display text-lg font-extrabold">Items</h2>
          <ul className="mt-4 space-y-4">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-4">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                  <Image
                    src={item.image || "/logo.png"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Qty {item.qty}
                    {Object.keys(item.variant).length > 0 &&
                      ` · ${Object.entries(item.variant)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}`}
                  </span>
                </span>
                <span className="font-bold">{formatPKR(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-bold">{formatPKR(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="font-bold">−{formatPKR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-bold">
                {order.shipping === 0 ? "FREE" : formatPKR(order.shipping)}
              </dd>
            </div>
            <div className="flex justify-between text-base">
              <dt className="font-display font-extrabold">Total ({order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod})</dt>
              <dd className="font-display text-xl font-extrabold text-[#D21F26]">
                {formatPKR(order.total)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm">
            <strong>Deliver to:</strong> {order.address.name}, {order.address.address},{" "}
            {order.address.city}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1 rounded-full bg-[#D21F26] py-6 font-bold hover:bg-[#a8161c]">
            <Link href="/orders">Track My Orders</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full py-6 font-bold">
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessClient />
    </Suspense>
  );
}
