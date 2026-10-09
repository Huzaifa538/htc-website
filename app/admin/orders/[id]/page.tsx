"use client";

/**
 * Order detail: items with variant options, customer + address, status
 * timeline stepper, status changer, print-friendly invoice (@media print).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Phone, User, Check, Circle } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Order, OrderStatus, SiteSettings, StaffMember } from "@/lib/types";
import { canTransition } from "@/lib/order-flow";
import { formatPKR } from "@/lib/format";
import { useDoc, useCollection, fmtDateTime, shortId } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/admin/ui";
import { InvoicePrintStyles } from "@/components/invoice/InvoicePrintView";
import { InvoiceButtons } from "@/components/invoice/InvoiceButtons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FLOW: OrderStatus[] = ["Pending", "Confirmed", "Shipped", "Delivered"];
const ALL_STATUSES: OrderStatus[] = [...FLOW, "Cancelled"];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { data: order, loading } = useDoc<Order>(COLLECTIONS.orders, id);
  const { data: settings } = useDoc<SiteSettings>(COLLECTIONS.siteSettings, "main");
  const { data: staff } = useCollection<StaffMember>(COLLECTIONS.staff);
  const [saving, setSaving] = useState(false);

  // Order kisi staff member ko assign karo (performance tracking)
  const assignTo = async (email: string) => {
    if (!db || !order) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.orders, order.id), {
        assignedTo: email || "",
        updatedAt: serverTimestamp(),
      });
      toast.success(email ? `Order ${email} ko assign ho gaya.` : "Assignment hata di.");
    } catch {
      toast.error("Assign nahi hua.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: OrderStatus) => {
    if (!db || !order) return;
    // Guard the lifecycle: terminal states are final, and steps move
    // forward one at a time (Cancelled is always an allowed side exit).
    if (!canTransition(order.status, status)) {
      toast.error(
        `Cannot move an order from ${order.status} to ${status}.`
      );
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.orders, order.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Order marked as ${status}.`);
    } catch {
      toast.error("Status update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Order management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Order" />
        <LoadingState rows={8} />
      </>
    );
  if (!order)
    return (
      <>
        <PageHeader title="Order" />
        <EmptyState title="Order not found" />
      </>
    );

  const flowIndex = order.status === "Cancelled" ? -1 : FLOW.indexOf(order.status);
  const itemsTotalQty = (order.items ?? []).reduce((s, i) => s + (i.qty ?? 0), 0);

  return (
    <>
      <InvoicePrintStyles />

      <div className="no-print">
        <PageHeader
          title={`Order #${shortId(order.id)}`}
          subtitle={`Placed ${fmtDateTime(order.createdAt)}`}
          actions={
            <>
              <Button variant="outline" onClick={() => router.push("/admin/orders")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <InvoiceButtons order={order} settings={settings ?? undefined} />
            </>
          }
        />
      </div>

      <div className="no-print grid gap-6 lg:grid-cols-3">
        {/* items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items ({itemsTotalQty})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(order.items ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} className="h-14 w-14 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-xs">—</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.variant && Object.keys(item.variant).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(item.variant).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="text-xs">
                          {k}: {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPKR(item.price)} × {item.qty}
                  </p>
                </div>
                <p className="font-semibold">{formatPKR((item.price ?? 0) * (item.qty ?? 0))}</p>
              </div>
            ))}
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPKR(order.subtotal)}</span>
              </div>
              {(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount{order.coupon ? ` (${order.coupon})` : ""}</span>
                  <span>−{formatPKR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{formatPKR(order.shipping)}</span>
              </div>
              {(order.tax ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatPKR(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatPKR(order.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Payment</span>
                <span>{order.paymentMethod}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* customer + status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4 text-muted-foreground" /> {order.address?.name ?? "—"}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> {order.address?.phone ?? "—"}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {order.address?.address}
                  <br />
                  {order.address?.city}
                </span>
              </p>
              {order.notes && (
                <p className="rounded bg-muted p-2 text-xs italic">“{order.notes}”</p>
              )}
              {order.userId && (
                <Button variant="link" size="sm" className="p-0" asChild>
                  <Link href={`/admin/customers?search=${encodeURIComponent(order.address?.phone ?? "")}`}>
                    View customer
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
              </div>
              {/* timeline stepper */}
              <ol className="space-y-3">
                {FLOW.map((s, i) => {
                  const done = flowIndex >= 0 && i <= flowIndex;
                  const current = i === flowIndex;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                          done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      </span>
                      <span className={`text-sm ${current ? "font-bold" : done ? "font-medium" : "text-muted-foreground"}`}>
                        {s}
                      </span>
                    </li>
                  );
                })}
                {order.status === "Cancelled" && (
                  <li className="flex items-center gap-3 text-destructive">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-destructive">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-bold">Cancelled</span>
                  </li>
                )}
              </ol>
              <div className="flex gap-2">
                <Select value={order.status} onValueChange={(v) => void changeStatus(v as OrderStatus)} disabled={saving || order.imported}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {order.imported && (
                <p className="text-xs text-muted-foreground">Imported history — read-only, status cannot be changed.</p>
              )}
              {/* Staff assignment — performance tracking ke liye */}
              {!order.imported && staff.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Assign to:</span>
                  <Select
                    value={order.assignedTo ?? ""}
                    onValueChange={(v) => void assignTo(v)}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.email}>
                          {s.name} ({s.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Updated {fmtDateTime(order.updatedAt)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

    </>
  );
}
