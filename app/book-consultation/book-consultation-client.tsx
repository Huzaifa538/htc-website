/**
 * /book-consultation — public consultation booking form → appointments.
 * Anyone can book; the admin team confirms from /admin/appointments.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAppointmentSlots, useServices } from "@/components/customer/data-hooks";
import { notifyOwnerAppointment } from "@/lib/whatsapp";

const schema = z.object({
  name: z.string().min(3, "Please enter your name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  date: z.string().min(1, "Please pick a date"),
  timeSlot: z.string().min(1, "Please pick a time slot"),
  serviceType: z.string().min(1, "Please choose a service"),
  notes: z.string().max(500, "Keep notes under 500 characters").optional(),
});

type Form = z.infer<typeof schema>;

function todayInput(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz
}

interface BookingSummary {
  name: string;
  date: string;
  timeSlot: string;
  serviceType: string;
}

export default function BookConsultationPage() {
  const slots = useAppointmentSlots();
  const { items: services } = useServices();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<BookingSummary | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      date: "",
      timeSlot: "",
      serviceType: "",
      notes: "",
    },
  });

  const serviceOptions = useMemo(() => {
    const names = services
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => s.name);
    return ["General consultation", ...names];
  }, [services]);

  async function onSubmit(data: Form) {
    if (!db || !isFirebaseConfigured()) {
      toast.error("Booking is unavailable right now — please WhatsApp us instead.");
      return;
    }
    setBusy(true);
    try {
      // Booking is server-side (POST /api/appointments): the API validates
      // the payload with zod before writing via the Admin SDK.
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          phone: data.phone.trim(),
          ...(data.email?.trim() ? { email: data.email.trim() } : {}),
          date: data.date,
          timeSlot: data.timeSlot,
          serviceType: data.serviceType,
          ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
        }),
      });
      const result = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        details?: { path: string; message: string }[];
      } | null;
      if (!res.ok || !result?.ok) {
        const detail = result?.details?.[0]?.message;
        throw new Error(detail || result?.error || "booking-failed");
      }
      setConfirmed({
        name: data.name.trim(),
        date: data.date,
        timeSlot: data.timeSlot,
        serviceType: data.serviceType,
      });
      // HTC-labeled owner WhatsApp alert — non-blocking, never fails booking.
      try {
        void notifyOwnerAppointment({
          name: data.name.trim(),
          phone: data.phone.trim(),
          date: data.date,
          timeSlot: data.timeSlot,
          serviceType: data.serviceType,
        });
      } catch {
        /* non-fatal */
      }
      reset();
      toast.success("Consultation requested!");
    } catch (e) {
      const message =
        e instanceof Error && e.message !== "booking-failed"
          ? e.message
          : "Could not submit your request — please try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="container max-w-2xl py-10">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <CalendarCheck size={14} /> Free consultation
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Book a Consultation
          </h1>
          <p className="mt-3 text-muted-foreground">
            Pick a day and time that suits you — our design team will call you
            back to confirm your free consultation.
          </p>
        </Reveal>

        {confirmed ? (
          <Reveal className="mt-8">
            <div className="rounded-3xl border bg-card p-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <h2 className="mt-4 font-display text-2xl font-extrabold">
                Request received{confirmed.name ? `, ${confirmed.name}` : ""}!
              </h2>
              <p className="mt-2 text-muted-foreground">
                {confirmed.serviceType} — {confirmed.date}, {confirmed.timeSlot}.
                <br />
                We&apos;ll call you shortly to confirm your slot.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={() => setConfirmed(null)}>Book another</Button>
                <Button variant="outline" asChild>
                  <Link href="/services">Browse services</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        ) : (
          <Reveal className="mt-8">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5 rounded-3xl border bg-card p-6 sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bk-name">Full name</Label>
                  <Input id="bk-name" placeholder="Your name" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-phone">Phone</Label>
                  <Input id="bk-phone" placeholder="03XX XXXXXXX" {...register("phone")} />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bk-email">Email (optional)</Label>
                <Input id="bk-email" type="email" placeholder="you@example.com" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bk-date">Preferred date</Label>
                  <Input
                    id="bk-date"
                    type="date"
                    min={todayInput()}
                    {...register("date")}
                  />
                  {errors.date && (
                    <p className="text-xs text-destructive">{errors.date.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-slot">Time slot</Label>
                  <select
                    id="bk-slot"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={watch("timeSlot")}
                    onChange={(e) => setValue("timeSlot", e.target.value, { shouldValidate: true })}
                  >
                    <option value="">Choose a slot…</option>
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.timeSlot && (
                    <p className="text-xs text-destructive">{errors.timeSlot.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bk-service">Service</Label>
                <select
                  id="bk-service"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={watch("serviceType")}
                  onChange={(e) => setValue("serviceType", e.target.value, { shouldValidate: true })}
                >
                  <option value="">Choose a service…</option>
                  {serviceOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.serviceType && (
                  <p className="text-xs text-destructive">{errors.serviceType.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bk-notes">Notes (optional)</Label>
                <Textarea
                  id="bk-notes"
                  rows={4}
                  placeholder="Tell us about your space — size, rooms, what you'd like done…"
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">{errors.notes.message}</p>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting…
                  </>
                ) : (
                  <>
                    <CalendarCheck className="mr-2 h-4 w-4" /> Request consultation
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                No payment needed — we confirm every booking by phone first.
              </p>
            </form>
          </Reveal>
        )}
      </div>
    </SiteShell>
  );
}
