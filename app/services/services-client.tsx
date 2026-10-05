/**
 * /services — interior design service cards with "Get Quote" links.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal, SectionHeading } from "@/components/customer/reveal";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { useServices } from "@/components/customer/data-hooks";
import { formatPKR } from "@/lib/format";

export default function ServicesPage() {
  const { items, loading, configured } = useServices();
  const list = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <Sparkles size={14} /> Interior design & home services
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Our Services
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            From a single room makeover to complete home interiors — HTC&apos;s
            design team handles everything, start to finish.
          </p>
        </Reveal>

        <div className="mt-10">
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : !configured || list.length === 0 ? (
            <EmptyState
              title="Services coming soon"
              description="Our interior design services are being prepared — check back shortly."
              actionLabel="Contact Us"
              actionHref="/contact"
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s, i) => (
                <Reveal key={s.id} delay={(i % 3) * 0.07}>
                  <Link
                    href={`/services/${s.slug || s.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1.5 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={s.image || "/logo.png"}
                        alt={s.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="font-display text-xl font-extrabold">{s.name}</h2>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        {s.priceFrom != null ? (
                          <span className="text-sm">
                            <span className="text-muted-foreground">Starting from </span>
                            <span className="font-display font-extrabold text-[#D21F26]">
                              {formatPKR(s.priceFrom)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Custom quote
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D21F26] px-5 py-2.5 text-sm font-bold text-white transition group-hover:bg-[#a8161c]">
                          Get Quote <ArrowRight size={15} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>

        <SectionHeading
          className="mt-20"
          eyebrow="How it works"
          title="From Idea to Interior in 4 Steps"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", t: "Free Consultation", d: "Tell us about your space on WhatsApp, call or the quote form." },
            { n: "2", t: "Design & Quote", d: "Our designers prepare layouts, 3D views and a transparent quote." },
            { n: "3", t: "Craft & Build", d: "Our workshop crafts your furniture while our team executes the site work." },
            { n: "4", t: "Handover", d: "Final polish, quality check and on-time handover of your new space." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <div className="h-full rounded-3xl bg-[#FBF3E4] p-6 dark:bg-stone-900/60">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D21F26] font-display text-xl font-extrabold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-[#D21F26] p-8 text-center text-white sm:flex-row sm:text-left">
            <div>
              <h2 className="font-display text-2xl font-extrabold">
                Not sure where to start?
              </h2>
              <p className="mt-2 max-w-xl text-white/85">
                Book a free consultation — tell us about your space and our
                design team will guide you from idea to interior.
              </p>
            </div>
            <Link
              href="/book-consultation"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[#D21F26] transition hover:bg-white/90"
            >
              <CalendarCheck size={16} /> Book Consultation
            </Link>
          </div>
        </Reveal>
      </div>
    </SiteShell>
  );
}
