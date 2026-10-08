/**
 * Combo Deals (MTR Store): list, create/edit, enable/disable, delete.
 * A combo is a named bundle of products with a bundle price shown on
 * the public /combos page.
 */
"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Gift, Pencil, Plus, Trash2, X } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Combo, WithId } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { TextField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts } from "@/components/customer/data-hooks";
import { formatPrice } from "@/lib/format";
import { getProductPrice } from "@/components/customer/product-utils";

const schema = z.object({
  title: z.string().min(3, "Min 3 characters").max(80),
  description: z.string().max(300).optional(),
  bundlePrice: z.coerce.number().positive("Must be positive"),
  order: z.coerce.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

export default function CombosPage() {
  const { data: combos, loading } = useCollection<Combo>(COLLECTIONS.combos);
  const { products } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<Combo> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Combo> | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", bundlePrice: 0, order: 0, enabled: true },
  });
  const { control, handleSubmit, reset } = form;

  function openCreate() {
    setEditing(null);
    setPickedIds([]);
    setSearch("");
    reset({ title: "", description: "", bundlePrice: 0, order: 0, enabled: true });
    setDialogOpen(true);
  }

  function openEdit(c: WithId<Combo>) {
    setEditing(c);
    setPickedIds(c.productIds ?? []);
    setSearch("");
    reset({
      title: c.title,
      description: c.description ?? "",
      bundlePrice: c.bundlePrice,
      order: c.order ?? 0,
      enabled: c.enabled,
    });
    setDialogOpen(true);
  }

  function togglePick(id: string) {
    setPickedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function onSubmit(values: FormValues) {
    if (!db) return;
    if (pickedIds.length < 2) {
      toast.error("Pick at least 2 products for a combo");
      return;
    }
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || "",
      productIds: pickedIds,
      bundlePrice: values.bundlePrice,
      order: values.order ?? 0,
      enabled: values.enabled,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.combos, editing.id), payload);
        toast.success("Combo updated");
      } else {
        await addDoc(collection(db, COLLECTIONS.combos), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Combo created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Could not save the combo");
    }
  }

  async function toggleEnabled(c: WithId<Combo>) {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.combos, c.id), { enabled: !c.enabled });
    } catch {
      toast.error("Could not update the combo");
    }
  }

  async function remove(c: WithId<Combo>) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.combos, c.id));
      toast.success("Combo deleted");
    } catch {
      toast.error("Could not delete the combo");
    } finally {
      setConfirmDelete(null);
    }
  }

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isFirebaseConfigured()) return <SetupWarning feature="Combo Deals" />;
  if (loading)
    return (
      <>
        <PageHeader title="Combo Deals" subtitle="Product bundles at bundle prices" />
        <LoadingState rows={5} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Combo Deals"
        subtitle="Bundles shown on the public /combos page"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New combo
          </Button>
        }
      />

      {combos.length === 0 ? (
        <EmptyState
          title="No combos yet"
          description="Create your first bundle — e.g. a Complete Door Kit."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {combos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b p-4 last:border-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Gift size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{c.title}</p>
                    <Badge variant={c.enabled ? "default" : "secondary"}>
                      {c.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <span className="text-sm font-extrabold text-[#D21F26]">
                      {formatPrice(c.bundlePrice)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {(c.productIds ?? []).length} products
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => toggleEnabled(c)} title="Enable/disable">
                  <span className="text-xs font-bold">{c.enabled ? "ON" : "OFF"}</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit">
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(c)}
                  aria-label="Delete"
                  className="text-red-600"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit combo" : "New combo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField control={control} name="title" label="Title" placeholder="Complete Door Kit" />
            <TextField
              control={control}
              name="description"
              label="Description (optional)"
              placeholder="Everything for one door: handle, lock, hinges…"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={control} name="bundlePrice" label="Bundle price (PKR)" type="number" />
              <TextField control={control} name="order" label="Sort order" type="number" />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">
                Products in this combo ({pickedIds.length} picked)
              </p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filtered.slice(0, 60).map((p) => {
                  const picked = pickedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePick(p.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        picked ? "bg-amber-100 font-semibold" : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {formatPrice(getProductPrice(p).price)}
                        {picked && <X size={14} className="text-red-600" />}
                      </span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No products match.</p>
                )}
              </div>
            </div>

            <SwitchField control={control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="submit">{editing ? "Save changes" : "Create combo"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete combo?"
        description={`"${confirmDelete?.title}" will be removed permanently.`}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
