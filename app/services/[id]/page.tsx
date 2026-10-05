/**
 * /services/[id] — service detail with gallery, starting price,
 * related projects, and a "Get Quote / Book Now" inquiry form
 * (writes to serviceInquiries).
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { buildServiceQuoteRequest } from "@/lib/quotations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProjects, useService } from "@/components/customer/data-hooks";
import { formatPKR } from "@/lib/format";

const inquirySchema = z.object({
  name: z.string().min(3, "Please enter your name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  message: z.string().min(10, "Tell us a little about your project (min 10 characters)"),
});

type InquiryForm = z.infer<typeof inquirySchema>;

const quoteRequestSchema = z.object({
  name: z.string().min(3, "Please enter your name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type QuoteRequestForm = z.infer<typeof quoteRequestSchema>;

/**
 * Small "Request an itemised quote" dialog — creates a quotation
 * (status "sent", brand "htc") that the admin prices in /admin/quotations.
 */
function QuoteRequestDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: { id: string; name: string };
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuoteRequestForm>({ resolver: zodResolver(quoteRequestSchema) });

  async function onSubmit(data: QuoteRequestForm) {
    if (!db || !isFirebaseConfigured()) {
      toast.error("Quote requests are unavailable right now — try WhatsApp instead.");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, COLLECTIONS.quotations), {
        ...buildServiceQuoteRequest({
          serviceId: service.id,
          serviceName: service.name,
          customerName: data.name,
          phone: data.phone,
          email: data.email,
          notes: data.notes,
          userId: user?.uid,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSent(true);
      reset();
      toast.success("Quote request sent! We'll price it and get back to you.");
    } catch {
      toast.error("Could not send the quote request — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSent(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-600" />
            <DialogTitle className="mt-4">Quote request received!</DialogTitle>
            <DialogDescription className="mt-2">
              Our team will prepare an itemised quotation for{" "}
              <strong>{service.name}</strong> and contact you shortly.
            </DialogDescription>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request an itemised quote</DialogTitle>
              <DialogDescription>
                For <strong>{service.name}</strong> — we&apos;ll prepare a
                proper priced quotation and share it with you.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
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
                <Label>Anything we should know? (optional)</Label>
                <Textarea
                  {...register("notes")}
                  rows={3}
                  placeholder="e.g. 2-bedroom apartment, need it done in a month…"
                  className="mt-1.5 rounded-xl"
                />
                {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="rounded-full bg-[#D21F26] px-8 font-bold hover:bg-[#a8161c]">
                  {busy ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                  Request Quote
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const openChat = useChatUiStore((s) => s.openChat);
  const { service, loading, configured } = useService(id);
  const { items: projects } = useProjects();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InquiryForm>({ resolver: zodResolver(inquirySchema) });

  async function onSubmit(data: InquiryForm) {
    if (!service || !db || !isFirebaseConfigured()) {
      toast.error("Inquiries are unavailable right now — try WhatsApp instead.");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, COLLECTIONS.serviceInquiries), {
        serviceId: service.id,
        serviceName: service.name,
        name: data.name.trim(),
        phone: data.phone.trim(),
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
        message: data.message.trim(),
        status: "New",
        createdAt: serverTimestamp(),
      });
      setSent(true);
      toast.success("Inquiry sent! Our team will contact you shortly.");
    } catch {
      toast.error("Could not send inquiry — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-10">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="mt-6 h-8 w-1/2" />
          <Skeleton className="mt-3 h-24 w-full" />
        </div>
      </SiteShell>
    );
  }

  if (!configured || !service) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Service not found"
            description="This service may have been removed."
            actionLabel="All Services"
            actionHref="/services"
          />
        </div>
      </SiteShell>
    );
  }

  const relatedProjects = [...projects]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);

  /** Open the HTC chat with this service attached. */
  function handleAskAbout() {
    if (!service) return;
    if (!user) {
      toast.error("Please sign in to chat about this service");
      router.push(`/login?next=${encodeURIComponent(`/services/${id}`)}`);
      return;
    }
    openChat({
      kind: "service",
      id: service.id,
      name: service.name,
      image: service.image || "/logo.png",
      detail:
        service.priceFrom != null
          ? `From ${formatPKR(service.priceFrom)}`
          : "Interior design service",
      href: `/services/${service.slug || service.id}`,
    });
    toast.success("Chat opened — ask us anything about this service");
  }

  return (
    <SiteShell>
      <div className="container py-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/services" className="hover:text-foreground">Services</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{service.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src={service.image || "/logo.png"}
                alt={service.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </Reveal>
          <div>
            <Reveal>
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
                {service.name}
              </h1>
              {service.priceFrom != null && (
                <p className="mt-4">
                  <span className="text-muted-foreground">Starting from </span>
                  <span className="rounded-full bg-[#D21F26] px-4 py-1.5 font-display text-xl font-extrabold text-white">
                    {formatPKR(service.priceFrom)}
                  </span>
                </p>
              )}
              <p className="mt-5 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {service.description}
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Free site visit & consultation",
                  "3D design views before execution",
                  "Transparent, itemised quotation",
                  "Dedicated project manager",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm font-medium">
                    <CheckCircle2 size={17} className="shrink-0 text-green-600" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#quote"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D21F26] px-8 py-3.5 font-bold text-white transition hover:bg-[#a8161c]"
              >
                Get Quote / Book Now <ArrowRight size={18} />
              </a>
              <button
                onClick={handleAskAbout}
                className="ml-3 mt-7 inline-flex items-center gap-2 rounded-full border-2 border-[#D21F26] px-8 py-3.5 font-bold text-[#D21F26] transition hover:bg-[#D21F26]/5"
              >
                <MessageCircle size={18} /> Ask about this
              </button>
              <button
                onClick={() => setQuoteOpen(true)}
                className="ml-3 mt-7 inline-flex items-center gap-2 rounded-full bg-stone-900 px-8 py-3.5 font-bold text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Request Itemised Quote
              </button>
            </Reveal>
          </div>
        </div>

        {/* Inquiry form */}
        <Reveal className="mt-14">
          <div id="quote" className="scroll-mt-24 rounded-3xl bg-[#FBF3E4] p-6 sm:p-10 dark:bg-stone-900/60">
            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={56} className="mx-auto text-green-600" />
                <h2 className="mt-4 font-display text-2xl font-extrabold">
                  Inquiry received!
                </h2>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                  Thank you for your interest in <strong>{service.name}</strong>.
                  Our design team will call you within 24 hours.
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-extrabold">
                  Request a Free Quote
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Fill this in and our team will contact you about{" "}
                  <strong>{service.name}</strong>.
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Full name *</Label>
                    <Input {...register("name")} placeholder="Your name" className="mt-1.5 rounded-xl bg-white dark:bg-stone-950" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input {...register("phone")} placeholder="03xx xxxxxxx" className="mt-1.5 rounded-xl bg-white dark:bg-stone-950" />
                    {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Email (optional)</Label>
                    <Input {...register("email")} placeholder="you@example.com" className="mt-1.5 rounded-xl bg-white dark:bg-stone-950" />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label>About your project *</Label>
                    <Textarea
                      {...register("message")}
                      rows={4}
                      placeholder="e.g. 2-bedroom apartment in DHA Lahore, need full interior…"
                      className="mt-1.5 rounded-xl bg-white dark:bg-stone-950"
                    />
                    {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={busy}
                      className="rounded-full bg-[#D21F26] px-10 py-6 font-bold hover:bg-[#a8161c]"
                    >
                      {busy ? <Loader2 size={17} className="mr-2 animate-spin" /> : <Send size={17} className="mr-2" />}
                      Send Inquiry
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </Reveal>

        {/* Related projects */}
        {relatedProjects.length > 0 && (
          <div className="mt-14">
            <h2 className="mb-6 font-display text-2xl font-extrabold">Our Work</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {relatedProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group relative block overflow-hidden rounded-3xl"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={p.images[0] || "/logo.png"}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="font-display font-extrabold text-white">{p.title}</h3>
                    <p className="text-sm text-white/70">{p.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <QuoteRequestDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        service={{ id: service.id, name: service.name }}
      />
    </SiteShell>
  );
}
