/**
 * Installation booking dialog — shown from the product page via a
 * "Book Installation" button. A technician visits the customer's
 * home/shop and fits the hardware for them.
 *
 * Writes to the `installationBookings` collection and fires a
 * WhatsApp alert to the owner (fire-and-forget, never blocks).
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { useLanguage } from "@/lib/i18n";
import { notifyOwnerInstallation } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const bookingSchema = z.object({
  name: z.string().trim().min(3, "Enter your name"),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  address: z.string().trim().min(10, "Enter the complete address"),
  city: z.string().trim().min(2, "Enter the city"),
  date: z.string().min(1, "Pick a date"),
  timeSlot: z.string().min(1, "Pick a time slot"),
  notes: z.string().trim().max(500).optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

export function InstallationBookingDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const i = t.installation;

  // Earliest bookable day is tomorrow.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: user?.displayName ?? "",
      timeSlot: i.slots[0],
    },
  });

  async function onSubmit(data: BookingForm) {
    if (submitting) return;
    if (!isFirebaseConfigured() || !db) {
      toast.error(i.failed);
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, COLLECTIONS.installationBookings), {
        productId,
        productName,
        name: data.name.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        date: data.date,
        timeSlot: data.timeSlot,
        ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
        ...(user?.uid ? { userId: user.uid } : {}),
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Owner WhatsApp alert — non-blocking.
      try {
        void notifyOwnerInstallation({
          productName,
          name: data.name.trim(),
          phone: data.phone.trim(),
          city: data.city.trim(),
          date: data.date,
          timeSlot: data.timeSlot,
        });
      } catch {
        /* non-fatal */
      }

      toast.success(i.success);
      reset();
      onOpenChange(false);
    } catch {
      toast.error(i.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={18} /> {i.bookTitle}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{i.subtitle}</p>
        </DialogHeader>

        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{i.product}: </span>
          <span className="font-semibold">{productName}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{i.fullName}</Label>
              <Input {...register("name")} />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label>{i.phone}</Label>
              <Input {...register("phone")} placeholder="03xx xxxxxxx" dir="ltr" />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>{i.address}</Label>
            <Input {...register("address")} />
            {errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{i.city}</Label>
              <Input {...register("city")} />
              {errors.city && (
                <p className="mt-1 text-xs text-red-600">{errors.city.message}</p>
              )}
            </div>
            <div>
              <Label>{i.preferredDate}</Label>
              <Input type="date" min={minDate} {...register("date")} />
              {errors.date && (
                <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>{i.timeSlot}</Label>
            <select
              {...register("timeSlot")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {i.slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>{i.notes}</Label>
            <Textarea
              {...register("notes")}
              placeholder={i.notesPlaceholder}
              rows={2}
            />
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground">{i.signInHint}</p>
          )}

          <Button type="submit" disabled={submitting} className="w-full rounded-full py-6 font-bold">
            {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
            {submitting ? i.submitting : i.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
