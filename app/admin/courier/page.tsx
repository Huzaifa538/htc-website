"use client";

/**
 * /admin/courier — courier shipment management.
 *
 * Lists all shipments (order id, courier, tracking #, status, date).
 * "Book Courier" opens the shared booking dialog (manual mode). Shipments
 * move through Booked → In Transit → Delivered, plus Cancelled.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Download, Plus, Truck } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Order, Shipment, ShipmentStatus, WithId } from "@/lib/types";
import {
  useCollection,
  fmtDate,
  shortId,
  tsMillis,
  downloadCsv,
} from "@/components/admin/firebase";
import { useAuth } from "@/components/providers";
import SetupWarning from "@/components/admin/SetupWarning";
import BookCourierDialog from "@/components/admin/BookCourierDialog";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SHIPMENT_COLORS: Record<ShipmentStatus, string> = {
  Booked: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  InTransit: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  Delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const SHIPMENT_LABELS: Record<ShipmentStatus, string> = {
  Booked: "Booked",
  InTransit: "In Transit",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

function ShipmentBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge className={`${SHIPMENT_COLORS[status]} border-0`}>
      {SHIPMENT_LABELS[status]}
    </Badge>
  );
}

/** Next status in the Booked → In Transit → Delivered flow. */
function nextStatus(s: ShipmentStatus): ShipmentStatus | null {
  if (s === "Booked") return "InTransit";
  if (s === "InTransit") return "Delivered";
  return null;
}

export default function CourierPage() {
  const { user } = useAuth();
  const { data: shipments, loading: shipmentsLoading } = useCollection<Shipment>(
    COLLECTIONS.shipments
  );
  const { data: orders, loading: ordersLoading } = useCollection<Order>(
    COLLECTIONS.orders
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState<WithId<Shipment> | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)),
    [shipments]
  );

  const setStatus = async (shipment: WithId<Shipment>, status: ShipmentStatus) => {
    if (!db) return;
    setUpdating(shipment.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.shipments, shipment.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Shipment marked as ${SHIPMENT_LABELS[status]}.`);
    } catch {
      toast.error("Status update failed.");
    } finally {
      setUpdating(null);
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Shipment ID", "Order ID", "Date", "Courier", "Tracking #", "Status", "Mode", "Booked by", "Notes"],
    ];
    for (const s of sorted) {
      rows.push([
        s.id,
        s.orderId,
        new Date(tsMillis(s.createdAt)).toLocaleString("en-PK"),
        s.courier,
        s.trackingNumber,
        SHIPMENT_LABELS[s.status],
        s.mode,
        s.bookedBy ?? "",
        s.notes ?? "",
      ]);
    }
    downloadCsv(`htc-shipments-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Courier management" />;
  if (shipmentsLoading || ordersLoading)
    return (
      <>
        <PageHeader title="Courier" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Courier"
        subtitle={`${sorted.length} shipment${sorted.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={sorted.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Book Courier
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No shipments yet"
          description="Book your first shipment — enter the tracking number from the courier's portal."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Truck className="mr-2 h-4 w-4" /> Book Courier
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Tracking #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Booked by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => {
                const next = nextStatus(s.status);
                const busy = updating === s.id;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${s.orderId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        #{shortId(s.orderId)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{s.courier}</TableCell>
                    <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                    <TableCell>
                      <ShipmentBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(s.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.bookedBy || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {next && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void setStatus(s, next)}
                          >
                            Mark {SHIPMENT_LABELS[next]}
                          </Button>
                        )}
                        {(s.status === "Booked" || s.status === "InTransit") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={busy}
                            onClick={() => setCancelling(s)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <BookCourierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orders={orders}
        shipments={shipments}
        adminEmail={user?.email}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel shipment?"
        description={`Tracking #${cancelling?.trackingNumber} will be marked as cancelled.`}
        confirmLabel="Cancel shipment"
        onConfirm={() => {
          if (cancelling) void setStatus(cancelling, "Cancelled");
          setCancelling(null);
        }}
      />
    </>
  );
}
