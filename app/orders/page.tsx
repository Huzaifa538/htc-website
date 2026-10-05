/**
 * /orders — order history with expandable rows and the status timeline.
 * Login required.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Loader2, Package, Truck } from "lucide-react";
import { useAuth } from "@/components/providers";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { OrderTimeline, StatusBadge } from "@/components/customer/order-timeline";
import { EmptyState } from "@/components/customer/skeletons";
import { useOrders, useShipments } from "@/components/customer/data-hooks";
import { tsMillis } from "@/components/customer/product-utils";
import { useDoc } from "@/components/admin/firebase";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InvoiceButtons } from "@/components/invoice/InvoiceButtons";
import { InvoicePrintStyles } from "@/components/invoice/InvoicePrintView";
import type { Order, Shipment, ShipmentStatus, SiteSettings, WithId } from "@/lib/types";

const TRACKING_STEPS: ShipmentStatus[] = ["Booked", "InTransit", "Delivered"];
const TRACKING_LABELS: Record<ShipmentStatus, string> = {
  Booked: "Booked",
  InTransit: "In Transit",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

/** Customer shipment-tracking card: courier, tracking # and progress steps. */
function ShipmentTrackingCard({ shipment }: { shipment: WithId<Shipment> }) {
  if (shipment.status === "Cancelled") {
    return (
      <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
        This shipment was cancelled. Contact us on WhatsApp if you need help.
      </div>
    );
  }
  const current = TRACKING_STEPS.indexOf(shipment.status);
  return (
    <div className="mt-6 rounded-2xl border bg-muted/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 font-display text-base font-extrabold">
          <Truck size={20} className="text-[#D21F26]" /> {shipment.courier}
        </span>
        <span className="text-sm">
          <span className="text-muted-foreground">Tracking # </span>
          <span className="font-mono font-bold">{shipment.trackingNumber}</span>
        </span>
      </div>
      <ol className="mt-4 flex items-center">
        {TRACKING_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className={cn("flex-1", i < TRACKING_STEPS.length - 1 && "pr-1")}>
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done
                      ? "bg-green-600 text-white"
                      : active
                        ? "bg-[#D21F26] text-white ring-4 ring-[#D21F26]/20"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check size={15} /> : i + 1}
                </span>
                {i < TRACKING_STEPS.length - 1 && (
                  <span
                    className={cn(
                      "mx-1 h-0.5 flex-1 rounded",
                      i < current ? "bg-green-600" : "bg-muted"
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[11px] font-bold sm:text-xs",
                  active ? "text-[#D21F26]" : "text-muted-foreground"
                )}
              >
                {TRACKING_LABELS[step]}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function OrderRow({
  order,
  shipment,
  settings,
}: {
  order: WithId<Order>;
  shipment?: WithId<Shipment>;
  settings?: Partial<SiteSettings>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
          <Package size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm font-bold">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(tsMillis(order.createdAt)).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {order.items.length} item{order.items.length > 1 ? "s" : ""} ·{" "}
            {order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod}
          </span>
        </span>
        <span className="hidden font-display text-lg font-extrabold text-[#D21F26] sm:block">
          {formatPKR(order.total)}
        </span>
        <StatusBadge status={order.status} />
        <ChevronDown
          size={18}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t px-5 py-5">
              <OrderTimeline status={order.status} />
              {shipment && <ShipmentTrackingCard shipment={shipment} />}
              <ul className="mt-6 space-y-3">
                {order.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={item.image || "/logo.png"}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Qty {item.qty}
                        {Object.keys(item.variant).length > 0 &&
                          ` · ${Object.entries(item.variant)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}`}
                      </span>
                    </span>
                    <span className="text-sm font-bold">
                      {formatPKR(item.price * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="font-bold">Delivery address</p>
                  <p className="mt-1 text-muted-foreground">
                    {order.address.name}, {order.address.address},{" "}
                    {order.address.city} · {order.address.phone}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="font-bold">Payment summary</p>
                  <p className="mt-1 text-muted-foreground">
                    Subtotal {formatPKR(order.subtotal)}
                    {order.discount > 0 && ` · Discount −${formatPKR(order.discount)}`}
                    {" · "}Shipping{" "}
                    {order.shipping === 0 ? "FREE" : formatPKR(order.shipping)}
                  </p>
                  <p className="mt-1 font-display text-lg font-extrabold text-[#D21F26]">
                    Total {formatPKR(order.total)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <InvoiceButtons order={order} settings={settings} size="sm" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading, configured } = useOrders(user?.uid);
  const { shipments } = useShipments(user?.uid);
  const { data: settings } = useDoc<SiteSettings>(COLLECTIONS.siteSettings, "main");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/orders");
  }, [authLoading, user, router]);

  const sorted = [...orders].sort(
    (a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)
  );

  const shipmentByOrder = useMemo(
    () => new Map(shipments.map((s) => [s.orderId, s])),
    [shipments]
  );

  return (
    <SiteShell>
      <InvoicePrintStyles />
      <div className="container max-w-4xl py-10">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            My Orders
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track every order from placement to your doorstep.
          </p>
        </Reveal>

        {authLoading || loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="animate-spin text-[#D21F26]" size={36} />
          </div>
        ) : !user ? (
          <div className="mt-8">
            <EmptyState
              title="Sign in required"
              description="Sign in to see your order history."
              actionLabel="Sign In"
              actionHref="/login?next=/orders"
            />
          </div>
        ) : !configured || sorted.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No orders yet"
              description="Your orders will appear here once you shop with us."
              actionLabel="Start Shopping"
              actionHref="/shop"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {sorted.map((o) => (
              <OrderRow key={o.id} order={o} shipment={shipmentByOrder.get(o.id)} settings={settings ?? undefined} />
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
