/**
 * Supplier directory: samaan kahan se aata hai, kis ke rates kaise hain.
 * Naya supplier add karo, rate compare ke liye notes likho, rating do.
 */
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";

import { useAuth } from "@/components/providers";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Supplier, WithId } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().min(2, "Naam likho"),
  phone: z.string().optional(),
  category: z.string().min(2, "Category likho (jaise Locks, Handles)"),
  notes: z.string().optional(),
  rating: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

export default function SuppliersPage() {
  useAuth();
  const { data: suppliers, loading } = useCollection<Supplier>(COLLECTIONS.suppliers);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<Supplier> | null>(null);
  const [deleting, setDeleting] = useState<WithId<Supplier> | null>(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = suppliers.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  if (!isFirebaseConfigured()) return <SetupWarning />;

  function openAdd() {
    setEditing(null);
    reset({ name: "", phone: "", category: "", notes: "", rating: "" });
    setDialogOpen(true);
  }
  function openEdit(s: WithId<Supplier>) {
    setEditing(s);
    reset({
      name: s.name,
      phone: s.phone ?? "",
      category: s.category,
      notes: s.notes ?? "",
      rating: s.rating ? String(s.rating) : "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (!db) return;
    setBusy(true);
    try {
      const ratingNum = Math.max(0, Math.min(5, parseInt(values.rating || "0", 10) || 0));
      const payload = {
        name: values.name.trim(),
        phone: values.phone?.trim() || "",
        category: values.category.trim(),
        notes: values.notes?.trim() || "",
        rating: ratingNum,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.suppliers, editing.id), payload);
        toast.success("Supplier update ho gaya");
      } else {
        await addDoc(collection(db, COLLECTIONS.suppliers), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Supplier add ho gaya");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Save nahi hua — dobara try karo");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!db || !deleting) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.suppliers, deleting.id));
      toast.success("Supplier delete ho gaya");
    } catch {
      toast.error("Delete nahi hua");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Samaan kahan se aata hai — rates compare karo, notes rakho"
        actions={
          <Button onClick={openAdd} className="rounded-full bg-[#D21F26] hover:bg-[#a8161c]">
            <Plus size={15} className="mr-1.5" /> Add Supplier
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search naam, category ya notes…"
          className="max-w-sm rounded-full"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Koi supplier nahi"
          description="Pehla supplier add karo taake rates track ho saken"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-extrabold">{s.name}</p>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[#D21F26]">
                      {s.category}
                    </p>
                  </div>
                  <Stars n={s.rating} />
                </div>
                {s.phone && (
                  <a
                    href={`tel:${s.phone.replace(/\D/g, "")}`}
                    className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Phone size={14} /> {s.phone}
                  </a>
                )}
                {s.notes && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.notes}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="rounded-full">
                    <Pencil size={13} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleting(s)}
                    className="rounded-full text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={13} className="mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Supplier edit karo" : "Naya supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Naam *</Label>
              <Input {...register("name")} placeholder="jaise Ahmed Hardware" className="mt-1" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="03xx xxxxxxx" className="mt-1" />
              </div>
              <div>
                <Label>Rating (0–5)</Label>
                <Input {...register("rating")} type="number" min={0} max={5} step={1} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Category *</Label>
              <Input {...register("category")} placeholder="jaise Locks, Handles" className="mt-1" />
              {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
            </div>
            <div>
              <Label>Notes (rates, udhaar, timing…)</Label>
              <Textarea {...register("notes")} rows={3} placeholder="jaise: tala 10% sasta, udhaar 15 din" className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="rounded-full bg-[#D21F26] hover:bg-[#a8161c]">
                {busy ? "Saving…" : editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Supplier delete karo?"
        description={`"${deleting?.name}" hamesha ke liye delete ho jayega.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
