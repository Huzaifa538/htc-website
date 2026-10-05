/**
 * Coupons (MTR Store): list, create/edit, enable/disable, delete.
 * Codes are matched case-insensitively at checkout (stored uppercase).
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
import { Plus, Pencil, Trash2 } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Coupon, WithId } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { TextField, SelectField, SwitchField } from "@/components/admin/FormFields";
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
import { formatPKR } from "@/lib/format";

const schema = z.object({
  code: z.string().min(3, "Min 3 characters").max(24),
  type: z.enum(["percent", "flat"]),
  value: z.coerce.number().positive("Must be positive"),
  minOrder: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().int().min(1).optional(),
  expiresAt: z.string().optional(),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

function couponLabel(c: WithId<Coupon>): string {
  return c.type === "percent" ? `${c.value}% off` : `${formatPKR(c.value)} off`;
}

export default function CouponsPage() {
  const { data: coupons, loading } = useCollection<Coupon>(COLLECTIONS.coupons);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<Coupon> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Coupon> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", type: "percent", value: 10, enabled: true },
  });
  const { control, handleSubmit, reset } = form;

  function openCreate() {
    setEditing(null);
    reset({ code: "", type: "percent", value: 10, enabled: true });
    setDialogOpen(true);
  }

  function openEdit(c: WithId<Coupon>) {
    setEditing(c);
    reset({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt
        ? new Date(c.expiresAt.toMillis()).toISOString().slice(0, 10)
        : "",
      enabled: c.enabled,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (!db) return;
    const payload = {
      code: values.code.trim().toUpperCase(),
      type: values.type,
      value: values.value,
      ...(values.minOrder ? { minOrder: values.minOrder } : {}),
      ...(values.maxUses ? { maxUses: values.maxUses } : {}),
      ...(values.expiresAt
        ? { expiresAt: Timestamp.fromDate(new Date(values.expiresAt)) }
        : {}),
      enabled: values.enabled,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.coupons, editing.id), payload);
        toast.success("Coupon updated");
      } else {
        await addDoc(collection(db, COLLECTIONS.coupons), {
          ...payload,
          usedCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Coupon created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Could not save the coupon");
    }
  }

  async function toggleEnabled(c: WithId<Coupon>) {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.coupons, c.id), { enabled: !c.enabled });
    } catch {
      toast.error("Could not update the coupon");
    }
  }

  async function remove(c: WithId<Coupon>) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.coupons, c.id));
      toast.success("Coupon deleted");
    } catch {
      toast.error("Could not delete the coupon");
    } finally {
      setConfirmDelete(null);
    }
  }

  if (!isFirebaseConfigured()) return <SetupWarning feature="Coupons" />;
  if (loading)
    return (
      <>
        <PageHeader title="Coupons" subtitle="MTR Store discount codes" />
        <LoadingState rows={5} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="MTR Store discount codes"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New coupon
          </Button>
        }      />

      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" description="Create your first discount code for the MTR Store." />
      ) : (
        <Card>
          <CardContent className="p-0">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 border-b p-4 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-bold">{c.code}</p>
                    <Badge variant={c.enabled ? "default" : "secondary"}>
                      {c.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {couponLabel(c)}
                    {c.minOrder ? ` · min order ${formatPKR(c.minOrder)}` : ""}
                    {c.maxUses ? ` · ${c.usedCount}/${c.maxUses} used` : ` · ${c.usedCount} used`}
                    {c.expiresAt
                      ? ` · expires ${new Date(c.expiresAt.toMillis()).toLocaleDateString("en-PK")}`
                      : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleEnabled(c)}>
                  {c.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit coupon">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(c)}
                  aria-label="Delete coupon"
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField control={control} name="code" label="Code" placeholder="EID10" />
            <SelectField
              control={control}
              name="type"
              label="Discount type"
              options={[
                { value: "percent", label: "Percent (%)" },
                { value: "flat", label: "Flat (PKR)" },
              ]}
            />
            <TextField control={control} name="value" label="Value" type="number" />
            <div className="grid grid-cols-2 gap-4">
              <TextField control={control} name="minOrder" label="Min order (PKR)" type="number" />
              <TextField control={control} name="maxUses" label="Max uses" type="number" />
            </div>
            <TextField control={control} name="expiresAt" label="Expiry date" type="date" />
            <SwitchField control={control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="submit">{editing ? "Save changes" : "Create coupon"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete coupon?"
        description={`Delete the code ${confirmDelete?.code ?? ""}? Customers will no longer be able to use it.`}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </>
  );
}
