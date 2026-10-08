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
import { Search, Ban, CheckCircle, ShoppingBag, Download, StickyNote, Crown, UserPlus, Repeat } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AppUser, Order } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, fmtDate, shortId, tsMillis, downloadCsv } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { PageHeader, EmptyState, LoadingState, StatusBadge, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Customer = AppUser & { blocked?: boolean };

/** Spend above which a customer counts as VIP. */
const VIP_SPEND = 50000;

type Segment = "new" | "repeat" | "vip";

function segmentOf(count: number, total: number): Segment {
  if (total >= VIP_SPEND) return "vip";
  if (count >= 1) return "repeat";
  return "new";
}

const SEGMENT_META: Record<Segment, { label: string; icon: typeof Crown; className: string }> = {
  new: { label: "New", icon: UserPlus, className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  repeat: { label: "Repeat", icon: Repeat, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  vip: { label: "VIP", icon: Crown, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const { data: users, loading } = useCollection<Customer>(COLLECTIONS.users);
  const { data: orders } = useCollection<Order>(COLLECTIONS.orders);

  const [search, setSearch] = useState(initialSearch);
  const [segmentFilter, setSegmentFilter] = useState<"all" | Segment>("all");
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<Customer | null>(null);
  const [notesFor, setNotesFor] = useState<Customer | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const orderStats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; orders: Order[]; lastOrder: number }>();
    for (const o of orders) {
      const key = o.userId || o.address?.phone || "";
      if (!key) continue;
      const cur = m.get(key) ?? { count: 0, total: 0, orders: [], lastOrder: 0 };
      cur.count += 1;
      if (o.status !== "Cancelled") cur.total += o.total ?? 0;
      const ms = tsMillis(o.createdAt);
      if (ms > cur.lastOrder) cur.lastOrder = ms;
      cur.orders.push(o);
      m.set(key, cur);
    }
    return m;
  }, [orders]);

  const statsOf = (u: Customer) =>
    orderStats.get(u.id) ??
    orderStats.get(u.phone ?? "") ?? { count: 0, total: 0, orders: [], lastOrder: 0 };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (!q) return true;
        const phones = (u.addresses ?? []).map((a) => a.phone).join(" ");
        return `${u.name} ${u.email} ${u.phone ?? ""} ${phones}`.toLowerCase().includes(q);
      })
      .filter((u) => {
        if (segmentFilter === "all") return true;
        const s = statsOf(u);
        return segmentOf(s.count, s.total) === segmentFilter;
      })
      .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, search, segmentFilter, orders]);

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

  const openNotes = (u: Customer) => {
    setNotesFor(u);
    setNotesText(u.notes ?? "");
  };

  const saveNotes = async () => {
    if (!db || !notesFor) return;
    setSavingNotes(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.users, notesFor.id), {
        notes: notesText.trim(),
      });
      toast.success("Notes saved.");
      setNotesFor(null);
    } catch {
      toast.error("Could not save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Name", "Email", "Phone", "Joined", "Segment", "Orders", "Total spent (PKR)", "Last order", "Notes"],
    ];
    for (const u of filtered) {
      const s = statsOf(u);
      const seg = segmentOf(s.count, s.total);
      rows.push([
        u.name ?? "",
        u.email ?? "",
        u.phone ?? u.addresses?.[0]?.phone ?? "",
        new Date(tsMillis(u.createdAt)).toLocaleDateString("en-PK"),
        SEGMENT_META[seg].label,
        s.count,
        Math.round(s.total),
        s.lastOrder ? new Date(s.lastOrder).toLocaleDateString("en-PK") : "—",
        u.notes ?? "",
      ]);
    }
    downloadCsv(`htc-customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Customers exported.");
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
      <PageHeader
        title="Customers"
        subtitle={`${filtered.length} of ${users.length} customers`}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as "all" | Segment)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="repeat">Repeat</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead>Segment</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const stats = statsOf(u);
                const seg = segmentOf(stats.count, stats.total);
                const SegIcon = SEGMENT_META[seg].icon;
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
                    <TableCell>
                      <Badge className={SEGMENT_META[seg].className}>
                        <SegIcon className="mr-1 h-3 w-3" />
                        {SEGMENT_META[seg].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                    <TableCell>{stats.count}</TableCell>
                    <TableCell className="font-semibold">{formatPKR(stats.total)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {stats.lastOrder
                        ? new Date(stats.lastOrder).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-40">
                      {u.notes ? (
                        <p className="truncate text-xs text-muted-foreground" title={u.notes}>
                          {u.notes}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.blocked ? <Badge variant="destructive">Blocked</Badge> : <Badge variant="outline">Active</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(u)}>
                          <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Orders
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openNotes(u)}>
                          <StickyNote className="mr-1 h-3.5 w-3.5" /> Notes
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

      {/* admin notes dialog */}
      <Dialog open={notesFor !== null} onOpenChange={(o) => !o && setNotesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {notesFor?.name}</DialogTitle>
            <DialogDescription>
              Internal notes only — the customer never sees these. e.g. &ldquo;prefers COD&rdquo;, &ldquo;wholesale buyer&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cust-notes">Notes</Label>
            <Textarea
              id="cust-notes"
              rows={4}
              placeholder="Write internal notes about this customer…"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesFor(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveNotes()} disabled={savingNotes}>
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
