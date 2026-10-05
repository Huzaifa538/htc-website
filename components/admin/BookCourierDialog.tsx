"use client";

/**
 * BookCourierDialog — shared courier-booking dialog used by the Courier
 * admin page and the per-order "Book Courier" button in the orders list.
 *
 * Manual mode only (no live courier API): staff book the parcel on the
 * courier's own portal, then paste the tracking number here. Always stores
 * userId (from the order) so customers can read their own shipments.
 */
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Truck } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type {
  CourierName,
  NewDoc,
  Order,
  Shipment,
  WithId,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COURIERS: CourierName[] = ["TCS", "Leopards", "Other"];

function orderLabel(o: WithId<Order>): string {
  const name = o.address?.name ?? "Customer";
  const total = o.total ?? 0;
  return `#${o.id.slice(0, 8).toUpperCase()} · ${name} · Rs ${total.toLocaleString("en-PK")}`;
}

export default function BookCourierDialog({
  open,
  onOpenChange,
  orders,
  shipments,
  prefilledOrderId,
  adminEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: WithId<Order>[];
  shipments: WithId<Shipment>[];
  /** When set, the dialog opens with this order selected (per-order button). */
  prefilledOrderId?: string | null;
  adminEmail?: string | null;
}) {
  const [orderId, setOrderId] = useState<string>("");
  const [courier, setCourier] = useState<CourierName>("TCS");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const shippedOrderIds = useMemo(
    () => new Set(shipments.map((s) => s.orderId)),
    [shipments]
  );

  // Orders eligible for a new booking: not cancelled, no shipment yet.
  const eligibleOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "Cancelled" && !shippedOrderIds.has(o.id))
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        ),
    [orders, shippedOrderIds]
  );

  // Reset / prefill whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setOrderId(prefilledOrderId ?? "");
      setCourier("TCS");
      setTrackingNumber("");
      setNotes("");
      setSaving(false);
    }
  }, [open, prefilledOrderId]);

  const save = async () => {
    if (!isFirebaseConfigured() || !db) {
      toast.error("Firebase is not configured.");
      return;
    }
    const order = eligibleOrders.find((o) => o.id === orderId);
    if (!order) {
      toast.error("Please select an order.");
      return;
    }
    const tracking = trackingNumber.trim();
    if (!tracking) {
      toast.error("Please enter the tracking number from the courier portal.");
      return;
    }
    setSaving(true);
    try {
      const payload: NewDoc<Shipment> = {
        orderId: order.id,
        userId: order.userId,
        courier,
        trackingNumber: tracking,
        status: "Booked",
        mode: "manual",
        bookedBy: adminEmail ?? "",
        notes: notes.trim() || undefined,
      };
      await addDoc(collection(db, COLLECTIONS.shipments), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`Shipment booked via ${courier}.`);
      onOpenChange(false);
    } catch {
      toast.error("Booking failed — please try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Book Courier
          </DialogTitle>
          <DialogDescription>
            Manual mode — book the parcel on the courier&apos;s portal first,
            then enter the tracking number here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Order</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an order…" />
              </SelectTrigger>
              <SelectContent>
                {eligibleOrders.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No orders waiting for courier.
                  </div>
                )}
                {eligibleOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {orderLabel(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Courier</Label>
              <Select
                value={courier}
                onValueChange={(v) => setCourier(v as CourierName)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURIERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking number</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. TCS tracking no."
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Booking remarks, rider name, COD note…"
            />
          </div>

          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Live API booking is disabled until courier credentials are entered
            and verified in Site Settings → Courier.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Booking…" : "Book shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
