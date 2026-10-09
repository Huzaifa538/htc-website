/**
 * Festival Sales (MTR Store): Eid/Diwali/Christmas par khaas discount.
 * Flash sale jaisa hi hai — admin dates + discount set karta hai,
 * storefront par prices automatic kam ho jati hain.
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
import { Plus, Pencil, Trash2, PartyPopper } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { FestivalSale, WithId } from "@/lib/types";
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
import { isFestivalSaleActive } from "@/lib/festival-sale";

// Aam festivals — ek click par naam bhar jata hai
const PRESETS = ["Eid ul-Fitr", "Eid ul-Adha", "Diwali", "Christmas", "New Year", "Independence Day"];

const schema = z.object({
  name: z.string().min(3, "Min 3 characters").max(60),
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

export default function FestivalsPage() {
  const { data: sales, loading } = useCollection<FestivalSale>(COLLECTIONS.festivalSales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<FestivalSale> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<FestivalSale> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", discountPct: 15, enabled: true },
  });
  const { control, handleSubmit, reset, setValue, watch } = form;
  const nameValue = watch("name");

  function openCreate() {
    setEditing(null);
    reset({ name: "", discountPct: 15, startsAt: "", endsAt: "", enabled: true });
    setDialogOpen(true);
  }

  function openEdit(s: WithId<FestivalSale>) {
    setEditing(s);
    reset({
      name: s.name,
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
      name: values.name.trim(),
      discountPct: values.discountPct,
      startsAt: Timestamp.fromDate(start),
      endsAt: Timestamp.fromDate(end),
      enabled: values.enabled,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.festivalSales, editing.id), payload);
        toast.success("Festival sale updated");
      } else {
        await addDoc(collection(db, COLLECTIONS.festivalSales), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Festival sale created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Could not save the festival sale");
    }
  }

  async function toggleEnabled(s: WithId<FestivalSale>) {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.festivalSales, s.id), { enabled: !s.enabled });
    } catch {
      toast.error("Could not update the festival sale");
    }
  }

  async function remove(s: WithId<FestivalSale>) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.festivalSales, s.id));
      toast.success("Festival sale deleted");
    } catch {
      toast.error("Could not delete the festival sale");
    } finally {
      setConfirmDelete(null);
    }
  }

  if (!isFirebaseConfigured()) return <SetupWarning feature="Festival Sales" />;
  if (loading)
    return (
      <>
        <PageHeader title="Festival Sales" subtitle="Eid, Diwali, Christmas discounts" />
        <LoadingState rows={5} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Festival Sales"
        subtitle="Tehwaron par khaas discount — dates set karo, prices khud kam ho jayengi"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New festival sale
          </Button>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          title="Koi festival sale nahi"
          description="Eid ya Diwali se pehle yahan discount lagao — storefront par khud apply ho jayega."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {sales.map((s) => {
              const live = isFestivalSaleActive(s);
              return (
                <div key={s.id} className="flex items-center gap-3 border-b p-4 last:border-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <PartyPopper size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{s.name}</p>
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
            <DialogTitle>{editing ? "Edit festival sale" : "New festival sale"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setValue("name", p)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      nameValue === p
                        ? "border-[#D21F26] bg-[#D21F26]/10 text-[#D21F26]"
                        : "hover:border-muted-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <TextField control={control} name="name" label="Festival name" placeholder="Eid ul-Fitr" />
            </div>
            <TextField
              control={control}
              name="discountPct"
              label="Discount %"
              type="number"
              placeholder="15"
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
        title="Delete festival sale?"
        description={`"${confirmDelete?.name}" will be removed permanently.`}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
