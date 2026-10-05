/**
 * Quotations (MTR Store + HTC Company): list, create, print/PDF,
 * status changes, and "Convert to Order".
 *
 * MTR quotations price hardware items (products or manual lines);
 * HTC quotations price interior-design services. A brand toggle filters
 * the list and sets the default brand for new quotations.
 *
 * Conversion to a real order goes through /api/admin/quotations/convert
 * (Admin SDK — client-side rules don't let admins create orders for other
 * customers).
 */
"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type {
  ChatBrand,
  Product,
  Quotation,
  QuotationItem,
  QuotationStatus,
  SiteSettings,
  WithId,
} from "@/lib/types";
import { QUOTATION_STATUS_LABELS } from "@/lib/types";
import { computeTotals, quotationNumber } from "@/lib/quotations";
import { useCollection, useDoc, fmtDateTime } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { TextField, TextAreaField } from "@/components/admin/FormFields";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { QuotationButtons } from "@/components/invoice/QuotationButtons";
import { QuotationPrintStyles } from "@/components/invoice/QuotationPrintView";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

const PHONE_RE = /^[+0-9][0-9\s-]{9,15}$/;

const schema = z.object({
  customerName: z.string().min(3, "Enter the customer name"),
  phone: z.string().regex(PHONE_RE, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  brand: z.enum(["mtr", "htc"]),
  serviceName: z.string().optional().or(z.literal("")),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
});

type FormValues = z.input<typeof schema>;

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  accepted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  converted:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

const BRAND_STYLES: Record<ChatBrand, string> = {
  mtr: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  htc: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

function StatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge className={cn("border-0", STATUS_STYLES[status])}>
      {QUOTATION_STATUS_LABELS[status]}
    </Badge>
  );
}

/* --------------------------- line-item editor --------------------------- */

function LineItemsEditor({
  items,
  onChange,
}: {
  items: QuotationItem[];
  onChange: (items: QuotationItem[]) => void;
}) {
  const { data: products } = useCollection<Product>(COLLECTIONS.products);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState({ name: "", qty: "1", price: "" });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (products ?? [])
      .filter(
        (p) =>
          p.published &&
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [products, search]);

  const patch = (index: number, field: keyof QuotationItem, value: string) => {
    const next = [...items];
    const cur = next[index];
    if (!cur) return;
    next[index] =
      field === "name"
        ? { ...cur, name: value }
        : { ...cur, [field]: Math.max(0, Number(value) || 0) };
    onChange(next);
  };

  const addManual = () => {
    if (!manual.name.trim()) {
      toast.error("Enter an item name.");
      return;
    }
    onChange([
      ...items,
      {
        name: manual.name.trim(),
        qty: Math.max(1, Math.round(Number(manual.qty) || 1)),
        unitPrice: Math.max(0, Math.round(Number(manual.price) || 0)),
      },
    ]);
    setManual({ name: "", qty: "1", price: "" });
  };

  return (
    <div className="space-y-3">
      <Label>Line items</Label>

      {/* product picker */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products to add… (name or SKU)"
          className="pl-9"
        />
        {matches.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border bg-background shadow-lg">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange([
                    ...items,
                    { name: p.name, qty: 1, unitPrice: Math.round(p.basePrice) },
                  ]);
                  setSearch("");
                }}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPKR(p.basePrice)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* rows */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_72px_110px_36px] items-center gap-2"
            >
              <Input
                value={item.name}
                onChange={(e) => patch(i, "name", e.target.value)}
                placeholder="Item name"
              />
              <Input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => patch(i, "qty", e.target.value)}
                aria-label="Quantity"
              />
              <Input
                type="number"
                min={0}
                value={item.unitPrice}
                onChange={(e) => patch(i, "unitPrice", e.target.value)}
                aria-label="Unit price (PKR)"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* manual line */}
      <div className="grid grid-cols-[1fr_72px_110px_auto] items-center gap-2">
        <Input
          value={manual.name}
          onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
          placeholder="Manual item — e.g. Labour charges"
        />
        <Input
          type="number"
          min={1}
          value={manual.qty}
          onChange={(e) => setManual((m) => ({ ...m, qty: e.target.value }))}
          aria-label="Quantity"
        />
        <Input
          type="number"
          min={0}
          value={manual.price}
          onChange={(e) => setManual((m) => ({ ...m, price: e.target.value }))}
          placeholder="Price"
          aria-label="Unit price (PKR)"
        />
        <Button type="button" variant="outline" size="icon" onClick={addManual} aria-label="Add line">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        MTR quotations price store products; HTC quotations can stay item-free
        (“items to be priced by our team”) or list service work manually.
      </p>
    </div>
  );
}

/* ------------------------------ create dialog ------------------------------ */

function CreateDialog({
  open,
  onOpenChange,
  defaultBrand,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBrand: ChatBrand;
}) {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      phone: "",
      email: "",
      brand: defaultBrand,
      serviceName: "",
      discount: 0,
      tax: 0,
      notes: "",
    },
  });
  const { control, handleSubmit, reset, watch } = form;
  const brand = watch("brand");
  const discount = Number(watch("discount")) || 0;
  const tax = Number(watch("tax")) || 0;
  const totals = useMemo(
    () => computeTotals(items, discount, tax),
    [items, discount, tax]
  );

  const openFresh = (b: ChatBrand) => {
    reset({
      customerName: "",
      phone: "",
      email: "",
      brand: b,
      serviceName: "",
      discount: 0,
      tax: 0,
      notes: "",
    });
    setItems([]);
  };

  async function onSubmit(data: FormValues) {
    if (!db || !isFirebaseConfigured()) {
      toast.error("Firebase is not configured.");
      return;
    }
    if (data.brand === "mtr" && items.length === 0) {
      toast.error("Add at least one line item for an MTR quotation.");
      return;
    }
    setBusy(true);
    try {
      // z.coerce inputs arrive as unknown in the input type; the resolver
      // has already validated them as numbers by submit time.
      const discount = Number(data.discount) || 0;
      const tax = Number(data.tax) || 0;
      const t = computeTotals(items, discount, tax);
      await addDoc(collection(db, COLLECTIONS.quotations), {
        customerName: data.customerName.trim(),
        phone: data.phone.trim(),
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
        items,
        subtotal: t.subtotal,
        discount: t.discount,
        ...(t.tax > 0 ? { tax: t.tax } : {}),
        total: t.total,
        status: "draft" satisfies QuotationStatus,
        brand: data.brand,
        ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
        ...(data.serviceName?.trim()
          ? { serviceName: data.serviceName.trim() }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Quotation created.");
      onOpenChange(false);
      openFresh(data.brand);
    } catch {
      toast.error("Could not create the quotation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) openFresh(defaultBrand);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New quotation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Tabs
            value={brand}
            onValueChange={(v) =>
              form.setValue("brand", v as ChatBrand, { shouldDirty: true })
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mtr">MTR Store</TabsTrigger>
              <TabsTrigger value="htc">HTC Company</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={control} name="customerName" label="Customer name *" placeholder="e.g. Ahmed Raza" />
            <TextField control={control} name="phone" label="Phone *" placeholder="03xx xxxxxxx" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={control} name="email" label="Email (optional)" placeholder="you@example.com" />
            {brand === "htc" && (
              <TextField control={control} name="serviceName" label="Service (optional)" placeholder="e.g. 2BHK interior" />
            )}
          </div>

          <LineItemsEditor items={items} onChange={setItems} />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField control={control} name="discount" label="Discount (Rs)" type="number" />
            <TextField control={control} name="tax" label="Tax (Rs)" type="number" />
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPKR(totals.subtotal)}</span>
              </p>
              <p className="mt-1 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPKR(totals.total)}</span>
              </p>
            </div>
          </div>

          <TextAreaField control={control} name="notes" label="Notes (optional)" rows={3} placeholder="Payment terms, validity, scope…" />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- detail dialog ------------------------------- */

function DetailDialog({
  quotation,
  onClose,
  onConverted,
}: {
  quotation: WithId<Quotation> | null;
  onClose: () => void;
  onConverted: () => void;
}) {
  const { data: settings } = useDoc<SiteSettings>(
    COLLECTIONS.siteSettings,
    "main"
  );
  const { user } = useAuth();
  const [converting, setConverting] = useState(false);

  async function convert() {
    if (!quotation || !user) return;
    setConverting(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/quotations/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, quotationId: quotation.id }),
      });
      const body = (await res.json().catch(() => null)) as
        | { orderId?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(body?.error ?? "Conversion failed.");
      toast.success(`Converted to order ${body?.orderId?.slice(0, 8).toUpperCase()}.`);
      onConverted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={quotation !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {quotation && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <FileText className="h-5 w-5" />
                Quotation {quotationNumber(quotation.id)}
                <StatusBadge status={quotation.status} />
                <Badge className={cn("border-0", BRAND_STYLES[quotation.brand])}>
                  {quotation.brand === "mtr" ? "MTR Store" : "HTC Company"}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Customer
                </p>
                <p className="mt-1 font-semibold">{quotation.customerName}</p>
                <p className="text-muted-foreground">{quotation.phone}</p>
                {quotation.email && (
                  <p className="text-muted-foreground">{quotation.email}</p>
                )}
                {quotation.serviceName && (
                  <p className="mt-2">
                    <span className="text-muted-foreground">Service: </span>
                    <span className="font-medium">{quotation.serviceName}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Created {fmtDateTime(quotation.createdAt)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Totals
                </p>
                <div className="mt-1 space-y-1">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPKR(quotation.subtotal)}</span>
                  </p>
                  {(quotation.discount ?? 0) > 0 && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span>−{formatPKR(quotation.discount)}</span>
                    </p>
                  )}
                  {(quotation.tax ?? 0) > 0 && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatPKR(quotation.tax)}</span>
                    </p>
                  )}
                  <p className="flex justify-between border-t pt-1 text-base font-bold">
                    <span>Total</span>
                    <span>{formatPKR(quotation.total)}</span>
                  </p>
                </div>
                {quotation.convertedOrderId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Converted → order {quotation.convertedOrderId.slice(0, 8).toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            {quotation.items.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-left">
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                      <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
                      <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-right">{item.qty}</td>
                        <td className="px-4 py-2.5 text-right">{formatPKR(item.unitPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {formatPKR((item.unitPrice ?? 0) * (item.qty ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No line items — items to be priced by our team.
              </p>
            )}

            {quotation.notes?.trim() && (
              <div className="rounded-xl bg-muted/60 p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <QuotationButtons
                quotation={quotation}
                settings={settings ?? undefined}
                size="sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                {quotation.status !== "converted" && (
                  <Button onClick={() => void convert()} disabled={converting}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {converting ? "Converting…" : "Convert to Order"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- page --------------------------------- */

const NEXT_STATUS: Partial<Record<QuotationStatus, QuotationStatus>> = {
  draft: "sent",
  sent: "accepted",
};

export default function QuotationsPage() {
  const { data, loading } = useCollection<Quotation>(COLLECTIONS.quotations, [
    orderBy("createdAt", "desc"),
  ]);
  const [brandFilter, setBrandFilter] = useState<"all" | ChatBrand>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WithId<Quotation> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Quotation> | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((qt) => {
      if (brandFilter !== "all" && qt.brand !== brandFilter) return false;
      if (!q) return true;
      return (
        qt.customerName.toLowerCase().includes(q) ||
        qt.phone.replace(/[\s-]/g, "").includes(q.replace(/[\s-]/g, "")) ||
        quotationNumber(qt.id).toLowerCase().includes(q) ||
        (qt.serviceName ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, brandFilter, search]);

  async function setStatus(qt: WithId<Quotation>, status: QuotationStatus) {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.quotations, qt.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Quotation marked ${QUOTATION_STATUS_LABELS[status].toLowerCase()}.`);
    } catch {
      toast.error("Could not update the quotation.");
    }
  }

  async function remove(qt: WithId<Quotation>) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.quotations, qt.id));
      toast.success("Quotation deleted.");
    } catch {
      toast.error("Could not delete the quotation.");
    } finally {
      setConfirmDelete(null);
    }
  }

  if (!isFirebaseConfigured()) return <SetupWarning />;

  return (
    <div className="space-y-6">
      <QuotationPrintStyles />
      <PageHeader
        title="Quotations"
        subtitle="Price quotes for MTR products and HTC services — print, share as PDF, or convert into orders."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New quotation
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={brandFilter} onValueChange={(v) => setBrandFilter(v as "all" | ChatBrand)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mtr">MTR Store</TabsTrigger>
            <TabsTrigger value="htc">HTC Company</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, phone, QT number…"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          description="Create your first quotation — or share a quote request link from a service page."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New quotation
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((qt) => (
            <Card key={qt.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <button
                  onClick={() => setDetail(qt)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{quotationNumber(qt.id)}</span>
                    <StatusBadge status={qt.status} />
                    <Badge className={cn("border-0", BRAND_STYLES[qt.brand])}>
                      {qt.brand === "mtr" ? "MTR Store" : "HTC Company"}
                    </Badge>
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {qt.customerName} · {qt.phone}
                    {qt.serviceName ? ` · ${qt.serviceName}` : ""}
                    {qt.items.length > 0 ? ` · ${qt.items.length} item${qt.items.length > 1 ? "s" : ""}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateTime(qt.createdAt)}
                  </span>
                </button>
                <div className="text-right">
                  <p className="text-lg font-extrabold">{formatPKR(qt.total)}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Quotation actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setDetail(qt)}>
                      <FileText className="mr-2 h-4 w-4" /> View & print / PDF
                    </DropdownMenuItem>
                    {NEXT_STATUS[qt.status] && (
                      <DropdownMenuItem
                        onClick={() => void setStatus(qt, NEXT_STATUS[qt.status]!)}
                      >
                        Mark as {QUOTATION_STATUS_LABELS[NEXT_STATUS[qt.status]!].toLowerCase()}
                      </DropdownMenuItem>
                    )}
                    {qt.status !== "converted" && (
                      <DropdownMenuItem onClick={() => setDetail(qt)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Convert to order…
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDelete(qt)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultBrand={brandFilter === "all" ? "mtr" : brandFilter}
      />
      <DetailDialog
        quotation={detail}
        onClose={() => setDetail(null)}
        onConverted={() => setDetail(null)}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete quotation?"
        description={`This permanently deletes quotation ${confirmDelete ? quotationNumber(confirmDelete.id) : ""} for ${confirmDelete?.customerName ?? ""}.`}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </div>
  );
}
