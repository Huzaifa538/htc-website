/**
 * /contact — form → contactMessages, Google Maps embed (address from
 * settings), WhatsApp button, working hours.
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiteSettings } from "@/components/customer/data-hooks";

const schema = z.object({
  name: z.string().min(3, "Please enter your name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  subject: z.string().min(3, "Please enter a subject"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type Form = z.infer<typeof schema>;

const HOURS = [
  { d: "Monday – Saturday", h: "10:00 AM – 8:00 PM" },
  { d: "Sunday", h: "11:00 AM – 6:00 PM" },
];

export default function ContactPage() {
  const { settings } = useSiteSettings();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    if (!db || !isFirebaseConfigured()) {
      toast.error("The form is unavailable — please WhatsApp us instead.");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, COLLECTIONS.contactMessages), {
        name: data.name.trim(),
        phone: data.phone.trim(),
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
        subject: data.subject.trim(),
        message: data.message.trim(),
        status: "New",
        createdAt: serverTimestamp(),
      });
      setSent(true);
      reset();
      toast.success("Message sent! We'll get back to you soon.");
    } catch {
      toast.error("Could not send message — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const address = settings?.address ?? "Lahore, Pakistan";
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const waDigits = (settings?.whatsappNumber ?? "").replace(/\D/g, "");

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Contact Us
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Questions about a product, an order, or a design project? We reply
            fast — usually within an hour.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Form */}
          <Reveal>
            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="font-display text-xl font-extrabold">Send a message</h2>
              {sent && (
                <p className="mt-3 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                  Message received — thank you! Our team will contact you shortly.
                </p>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full name *</Label>
                  <Input {...register("name")} placeholder="Your name" className="mt-1.5 rounded-xl" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input {...register("phone")} placeholder="03xx xxxxxxx" className="mt-1.5 rounded-xl" />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
                </div>
                <div>
                  <Label>Email (optional)</Label>
                  <Input {...register("email")} placeholder="you@example.com" className="mt-1.5 rounded-xl" />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                  <Label>Subject *</Label>
                  <Input {...register("subject")} placeholder="e.g. Sofa delivery time" className="mt-1.5 rounded-xl" />
                  {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label>Message *</Label>
                  <Textarea {...register("message")} rows={5} placeholder="How can we help?" className="mt-1.5 rounded-xl" />
                  {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[#D21F26] px-10 py-6 font-bold hover:bg-[#a8161c]"
                  >
                    {busy ? <Loader2 size={17} className="mr-2 animate-spin" /> : <Send size={17} className="mr-2" />}
                    Send Message
                  </Button>
                </div>
              </form>
            </div>

            {/* Map */}
            <div className="mt-8 overflow-hidden rounded-3xl border">
              <iframe
                title="HTC location map"
                src={mapSrc}
                className="h-72 w-full"
                loading="lazy"
              />
            </div>
          </Reveal>

          {/* Info cards */}
          <div className="space-y-4">
            {settings?.phone && (
              <Reveal delay={0.05}>
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="flex items-center gap-4 rounded-3xl border bg-card p-5 transition hover:shadow-lg">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
                    <Phone size={22} />
                  </span>
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Call us</span>
                    <span className="font-display font-extrabold">{settings.phone}</span>
                  </span>
                </a>
              </Reveal>
            )}
            {waDigits && (
              <Reveal delay={0.1}>
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 rounded-3xl bg-[#25D366] p-5 text-white transition hover:shadow-lg"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                    <MessageCircle size={22} />
                  </span>
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-wider text-white/80">WhatsApp</span>
                    <span className="font-display font-extrabold">Chat instantly</span>
                  </span>
                </a>
              </Reveal>
            )}
            {settings?.email && (
              <Reveal delay={0.15}>
                <a href={`mailto:${settings.email}`} className="flex items-center gap-4 rounded-3xl border bg-card p-5 transition hover:shadow-lg">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
                    <Mail size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</span>
                    <span className="block truncate font-display font-extrabold">{settings.email}</span>
                  </span>
                </a>
              </Reveal>
            )}
            <Reveal delay={0.2}>
              <div className="rounded-3xl border bg-card p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <MapPin size={15} className="text-[#D21F26]" /> Visit us
                </p>
                <p className="mt-2 font-semibold">{address}</p>
              </div>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="rounded-3xl bg-[#FBF3E4] p-5 dark:bg-stone-900/60">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Clock size={15} className="text-[#D21F26]" /> Working hours
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {HOURS.map((h) => (
                    <li key={h.d} className="flex justify-between gap-3">
                      <span className="font-semibold">{h.d}</span>
                      <span className="text-muted-foreground">{h.h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
