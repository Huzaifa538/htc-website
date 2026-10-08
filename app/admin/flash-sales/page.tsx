/**
 * Flash Sales (MTR Store): list, create/edit, enable/disable, delete.
 * An enabled sale whose window contains "now" shows as a countdown
 * banner on the storefront with the discount applied to prices.
 */
"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { FlashSale, WithId } from "@/lib/types";
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
import { isFlashSaleActive } from "@/lib/flash-sale";

const schema = z.object({
  title: z.string().min(3, "Min 3 characters").max(60),
  discountPct: z.coerce.number().min(1, "Min 1%").max(90, "Max 90%"),
  startsAt: z.string().min(1, "Start time required"),
  endsAt: z.string().min(1, "End time required"),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

function toInputValue(t: Timestamp | undefined): string {
  if (!t) return "";
  const d = new Date(t.toMillis());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FlashSalesPage() {
  const { data: sales, loading } = useCollection<FlashSale>(COLLECTIONS.flashSales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<FlashSale> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<FlashSale> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", discountPct: 20, enabled: true },
  });
  const { control, handleSubmit, reset } = form;

  function openCreate() {
    setEditing(null);
    reset({ title: "", discountPct: 20, startsAt: "", endsAt: "", enabled: true });
    setDialogOpen(true);
  }

  function openEdit(s: WithId<FlashSale>) {
    setEditing(s);
    reset({
      title: s.title,
      discountPct: s.discountPct,
      startsAt: toInputValue(s.startsAt),
      endsAt: toInputValue(s.endsAt),
      enabled: s.enabled,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (!db) return;
    const start = new Date(values.startsAt);
    const end = new Date(values.endsAt);
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }
    const payload = {
      title: values.title.trim(),
      discountPct: values.discountPct,
      startsAt: Timestamp.fromDate(start),
      endsAt: Timestamp.fromDate(end),
      enabled: values.enabled,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.flashSales, editing.id), payload);
        toast.success("Flash sale updated");
      } else {
        await addDoc(collection(db, COLLECTIONS.flashSales), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Flash sale created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Could not save the flash sale");
    }
  }

  async function toggleEnabled(s: WithId<FlashSale>) {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.flashSales, s.id), { enabled: !s.enabled });
    } catch {
      toast.error("Could not update the flash sale");
    }
  }

  async function remove(s: WithId<FlashSale>) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.flashSales, s.id));
      toast.success("Flash sale deleted");
    } catch {
      toast.error("Could not delete the flash sale");
    } finally {
      setConfirmDelete(null);
    }
  }

  if (!isFirebaseConfigured()) return <SetupWarning feature="Flash Sales" />;
  if (loading)
    return (
      <>
        <PageHeader title="Flash Sales" subtitle="Time-boxed storefront discounts" />
        <LoadingState rows={5} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Flash Sales"
        subtitle="Countdown banner + discounted prices on the storefront"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New flash sale
          </Button>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          title="No flash sales yet"
          description="Create one — it shows as a live countdown banner with discounted prices."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {sales.map((s) => {
              const live = isFlashSaleActive(s);
              return (
                <div key={s.id} className="flex items-center gap-3 border-b p-4 last:border-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-[#D21F26]">
                    <Zap size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{s.title}</p>
                      <Badge variant={live ? "default" : s.enabled ? "secondary" : "outline"}>
                        {live ? "LIVE" : s.enabled ? "Scheduled" : "Disabled"}
                      </Badge>
                      <span className="text-sm font-extrabold text-[#D21F26]">
                        {s.discountPct}% off
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(s.startsAt.toMillis()).toLocaleString()} →{" "}
                      {new Date(s.endsAt.toMillis()).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleEnabled(s)} title="Enable/disable">
                    <span className="text-xs font-bold">{s.enabled ? "ON" : "OFF"}</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit">
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(s)}
                    aria-label="Delete"
                    className="text-red-600"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit flash sale" : "New flash sale"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField control={control} name="title" label="Title" placeholder="Eid Flash Sale" />
            <TextField
              control={control}
              name="discountPct"
              label="Discount %"
              type="number"
              placeholder="20"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={control} name="startsAt" label="Starts at" type="datetime-local" />
              <TextField control={control} name="endsAt" label="Ends at" type="datetime-local" />
            </div>
            <SwitchField control={control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="submit">{editing ? "Save changes" : "Create sale"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete flash sale?"
        description={`"${confirmDelete?.title}" will be removed permanently.`}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
