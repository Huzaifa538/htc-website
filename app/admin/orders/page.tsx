"use client";

/**
 * Orders list: search, status filter, CSV export.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, Truck } from "lucide-react";

import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Order, OrderStatus, Shipment } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, fmtDate, shortId, tsMillis, downloadCsv } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import BookCourierDialog from "@/components/admin/BookCourierDialog";
import { useAuth } from "@/components/providers";
import { PageHeader, EmptyState, LoadingState, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES: ("all" | OrderStatus)[] = ["all", "Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

export default function OrdersPage() {
  const { user } = useAuth();
  const { data: orders, loading } = useCollection<Order>(COLLECTIONS.orders);
  const { data: shipments } = useCollection<Shipment>(COLLECTIONS.shipments);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [bookOrderId, setBookOrderId] = useState<string | null>(null);

  const shippedOrderIds = useMemo(
    () => new Set(shipments.map((s) => s.orderId)),
    [shipments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (status !== "all" && o.status !== status) return false;
        if (!q) return true;
        const hay = `${o.id} ${o.address?.name ?? ""} ${o.address?.phone ?? ""} ${o.coupon ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
  }, [orders, search, status]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Order ID", "Date", "Customer", "Phone", "City", "Items", "Subtotal", "Discount", "Shipping", "Tax", "Total", "Payment", "Status", "Coupon"],
    ];
    for (const o of filtered) {
      rows.push([
        o.id,
        new Date(tsMillis(o.createdAt)).toLocaleString("en-PK"),
        o.address?.name ?? "",
        o.address?.phone ?? "",
        o.address?.city ?? "",
        (o.items ?? []).map((i) => `${i.name} x${i.qty}`).join("; "),
        o.subtotal ?? 0,
        o.discount ?? 0,
        o.shipping ?? 0,
        o.tax ?? 0,
        o.total ?? 0,
        o.paymentMethod ?? "",
        o.status,
        o.coupon ?? "",
      ]);
    }
    downloadCsv(`htc-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Order management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Orders" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${filtered.length} of ${orders.length} orders · 405 of 692 historical orders imported (86 discontinued SKUs skipped)`}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order ID, name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No orders found" description="Try a different search or status filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">
                      #{shortId(o.id)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{o.address?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{o.address?.phone}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                  <TableCell>{(o.items ?? []).reduce((s, i) => s + (i.qty ?? 0), 0)}</TableCell>
                  <TableCell className="font-semibold">{formatPKR(o.total)}</TableCell>
                  <TableCell className="text-sm">{o.paymentMethod}</TableCell>
                  <TableCell>
                    {o.imported ? (
                      <Badge variant="outline">Imported history</Badge>
                    ) : (
                      <StatusBadge status={o.status} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!o.imported && o.status !== "Cancelled" && !shippedOrderIds.has(o.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBookOrderId(o.id)}
                        title="Book courier for this order"
                      >
                        <Truck className="mr-1.5 h-3.5 w-3.5" /> Book Courier
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BookCourierDialog
        open={bookOrderId !== null}
        onOpenChange={(o) => !o && setBookOrderId(null)}
        orders={orders}
        shipments={shipments}
        prefilledOrderId={bookOrderId}
        adminEmail={user?.email}
      />
    </>
  );
}
