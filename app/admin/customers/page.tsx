"use client";

/**
 * Customers: users collection table, per-customer order history,
 * block / unblock (local `blocked` flag — not part of the base AppUser
 * contract, see handoff notes).
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Search, Ban, CheckCircle, ShoppingBag } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AppUser, Order } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, fmtDate, shortId, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { PageHeader, EmptyState, LoadingState, StatusBadge, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Customer = AppUser & { blocked?: boolean };

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const { data: users, loading } = useCollection<Customer>(COLLECTIONS.users);
  const { data: orders } = useCollection<Order>(COLLECTIONS.orders);

  const [search, setSearch] = useState(initialSearch);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<Customer | null>(null);

  const orderStats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; orders: Order[] }>();
    for (const o of orders) {
      const key = o.userId || o.address?.phone || "";
      if (!key) continue;
      const cur = m.get(key) ?? { count: 0, total: 0, orders: [] };
      cur.count += 1;
      if (o.status !== "Cancelled") cur.total += o.total ?? 0;
      cur.orders.push(o);
      m.set(key, cur);
    }
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (!q) return true;
        const phones = (u.addresses ?? []).map((a) => a.phone).join(" ");
        return `${u.name} ${u.email} ${u.phone ?? ""} ${phones}`.toLowerCase().includes(q);
      })
      .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
  }, [users, search]);

  const toggleBlock = async (u: Customer) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.users, u.id), { blocked: !u.blocked });
      toast.success(u.blocked ? "Customer unblocked." : "Customer blocked.");
    } catch {
      toast.error("Update failed.");
    } finally {
      setConfirmBlock(null);
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Customer management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Customers" />
        <LoadingState rows={8} />
      </>
    );

  const viewingOrders = viewing
    ? (orderStats.get(viewing.id)?.orders ?? []).sort(
        (a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)
      )
    : [];

  return (
    <>
      <PageHeader title="Customers" subtitle={`${filtered.length} of ${users.length} customers`} />

      <div className="relative min-w-56 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No customers found" description="Registered users will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const stats = orderStats.get(u.id) ?? orderStats.get(u.phone ?? "") ?? { count: 0, total: 0 };
                return (
                  <TableRow key={u.id} className={u.blocked ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.photoURL ?? ""} />
                          <AvatarFallback>{(u.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.phone ?? u.addresses?.[0]?.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                    <TableCell>{stats.count}</TableCell>
                    <TableCell className="font-semibold">{formatPKR(stats.total)}</TableCell>
                    <TableCell>
                      {u.blocked ? <Badge variant="destructive">Blocked</Badge> : <Badge variant="outline">Active</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(u)}>
                          <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Orders
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={u.blocked ? "text-emerald-600" : "text-destructive"}
                          onClick={() => (u.blocked ? void toggleBlock(u) : setConfirmBlock(u))}
                        >
                          {u.blocked ? (
                            <>
                              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Unblock
                            </>
                          ) : (
                            <>
                              <Ban className="mr-1 h-3.5 w-3.5" /> Block
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* order history dialog */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orders — {viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewingOrders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <div className="space-y-2">
              {viewingOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-mono text-xs text-primary">#{shortId(o.id)}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</p>
                  </div>
                  <p className="font-semibold">{formatPKR(o.total)}</p>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmBlock !== null}
        onOpenChange={(o) => !o && setConfirmBlock(null)}
        title="Block customer?"
        description={`${confirmBlock?.name} will be blocked from placing orders and logging in. You can unblock them later.`}
        confirmLabel="Block"
        onConfirm={() => {
          if (confirmBlock) void toggleBlock(confirmBlock);
        }}
      />
    </>
  );
}
