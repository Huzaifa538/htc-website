/**
 * /portfolio — interior-design portfolio with before/after comparison sliders.
 * Projects are managed in Admin → Projects (before/after photos are optional;
 * projects without the pair fall back to their cover image).
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Hammer, MapPin } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { BeforeAfterSlider } from "@/components/customer/before-after-slider";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { useProjects } from "@/components/customer/data-hooks";
import { fmtDate } from "@/components/admin/firebase";

export default function PortfolioPage() {
  const { items, loading, configured } = useProjects();

  const list = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const withPair = list.filter((p) => p.beforeImage && p.afterImage);
  const rest = list.filter((p) => !(p.beforeImage && p.afterImage));

  return (
    <SiteShell>
      <div className="container py-10 sm:py-14">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <Hammer size={14} /> Interior design portfolio
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Before <span className="text-[#D21F26]">&amp;</span> After
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Real spaces transformed by the HTC design team. Drag the handle to
            compare — every project below started as an empty room.
          </p>
        </Reveal>

        {loading ? (
          <ProductGridSkeleton />
        ) : !configured || list.length === 0 ? (
          <EmptyState
            title="Portfolio coming soon"
            description="Our latest interior transformations will appear here."
          />
        ) : (
          <>
            {/* Before/after showcase */}
            {withPair.length > 0 && (
              <div className="mt-10 space-y-12">
                {withPair.map((p, i) => (
                  <Reveal key={p.id}>
                    <article
                      className={`grid items-center gap-6 lg:grid-cols-2 ${
                        i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                      }`}
                    >
                      <BeforeAfterSlider
                        before={p.beforeImage!}
                        after={p.afterImage!}
                        alt={p.title}
                        className="shadow-xl"
                      />
                      <div>
                        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                          {p.title}
                        </h2>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} /> {p.location}
                          </span>
                          <span>{fmtDate(p.startDate)}</span>
                        </p>
                        <p className="mt-4 leading-relaxed text-muted-foreground">
                          {p.description}
                        </p>
                        <Link
                          href="/book-consultation"
                          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D21F26] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#a8161c]"
                        >
                          Book a consultation <ArrowRight size={16} />
                        </Link>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}

            {/* Other projects (no before/after pair yet) */}
            {rest.length > 0 && (
              <div className="mt-16">
                <h2 className="font-display text-2xl font-extrabold">
                  More of our work
                </h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <Reveal key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="group block overflow-hidden rounded-3xl border bg-card transition hover:shadow-xl"
                      >
                        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                          {p.images?.[0] ? (
                            <Image
                              src={p.images[0]}
                              alt={p.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <h3 className="font-display text-lg font-bold group-hover:text-[#D21F26]">
                            {p.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin size={12} /> {p.location}
                          </p>
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* CTA banner */}
        <Reveal className="mt-16">
          <div className="relative overflow-hidden rounded-3xl bg-[#1a1a1a] p-8 text-white sm:p-12">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#D21F26]/30 blur-3xl"
              aria-hidden
            />
            <div className="relative max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#ff6b6b]">
                <CalendarCheck size={14} /> Free consultation
              </p>
              <h2 className="mt-3 font-display text-2xl font-extrabold sm:text-4xl">
                Like what you see? Let&apos;s design your space.
              </h2>
              <p className="mt-3 text-white/70">
                Tell us about your room and our designers will plan the full
                transformation — furniture, fittings and finishes.
              </p>
              <Link
                href="/book-consultation"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D21F26] px-8 py-3.5 font-bold text-white transition hover:bg-[#a8161c]"
              >
                Book Consultation <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </SiteShell>
  );
}
