/**
 * /about — story, mission/vision, team highlights, stats from the
 * aboutContent document, with graceful fallbacks.
 */
"use client";

import Image from "next/image";
import { Award, Eye, HeartHandshake, Target } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal, SectionHeading, AnimatedCounter } from "@/components/customer/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAboutContent } from "@/components/customer/data-hooks";

const FALLBACK = {
  heading: "Hardware You Can Trust Since 2010",
  body: `HTC — Hammer Trading Company began as a small hardware shop in Lahore with one belief: Pakistani homes and builders deserve genuine, quality hardware that lasts.\n\nToday we run our own store and online shop delivering nationwide — door locks, handles, hinges, tower bolts, epoxy resin and hand tools, all sourced from trusted suppliers and quality-checked before dispatch.\n\nWe sell online with cash on delivery because trust comes first — you inspect your order at your doorstep before you pay a single rupee.`,
  images: [] as string[],
  stats: [
    { label: "Years of Craft", value: "15+" },
    { label: "Happy Customers", value: "2500+" },
    { label: "Projects Delivered", value: "120+" },
    { label: "Cities Served", value: "40+" },
  ],
};

export default function AboutPage() {
  const { about, loading, configured } = useAboutContent();
  const content = configured && about ? about : FALLBACK;

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-10">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </SiteShell>
    );
  }

  const numericStats = content.stats.map((s) => {
    const m = s.value.match(/(\d+)/);
    return { label: s.label, value: m ? Number(m[1]) : 0, suffix: s.value.replace(/[\d]/g, "") || "" };
  });

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            Our story
          </p>
          <h1 className="max-w-3xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            {content.heading}
          </h1>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-4 whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {content.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-[#FBF3E4] p-6 dark:bg-stone-900/60">
                <Target size={24} className="text-[#D21F26]" />
                <h2 className="mt-3 font-display text-lg font-bold">Our Mission</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  To make genuine, long-lasting door hardware and fittings
                  accessible to every Pakistani household — honestly priced,
                  honestly sourced.
                </p>
              </div>
              <div className="rounded-3xl bg-[#FBF3E4] p-6 dark:bg-stone-900/60">
                <Eye size={24} className="text-[#D21F26]" />
                <h2 className="mt-3 font-display text-lg font-bold">Our Vision</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  To be Pakistan&apos;s most trusted hardware trading brand —
                  the first name that comes to mind when a family builds or
                  secures its home.
                </p>
              </div>
            </div>
          </Reveal>
          <div className="space-y-4">
            {(content.images.length > 0 ? content.images : []).slice(0, 3).map((src, i) => (
              <Reveal key={src} delay={i * 0.08}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-3xl">
                  <Image
                    src={src}
                    alt={`HTC workshop ${i + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </Reveal>
            ))}
            {content.images.length === 0 && (
              <Reveal delay={0.1}>
                <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-3xl bg-stone-950">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#D21F26_0%,transparent_60%)] opacity-50" />
                  <Image
                    src="/logo.png"
                    alt="HTC — Hammer Trading"
                    width={120}
                    height={120}
                    className="relative rounded-3xl bg-white p-3"
                  />
                </div>
              </Reveal>
            )}
          </div>
        </div>

        {/* Stats */}
        <section className="mt-16 rounded-3xl bg-stone-950 p-8 text-white sm:p-12 dark:bg-stone-900">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {numericStats.map((s) => (
              <div key={s.label} className="text-center">
                <AnimatedCounter
                  value={s.value}
                  suffix={s.suffix}
                  className="text-4xl text-[#D21F26] sm:text-5xl"
                />
                <p className="mt-2 text-sm text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="mt-16">
          <SectionHeading eyebrow="What we stand for" title="Our Values" />
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: Award,
                t: "Craftsmanship First",
                d: "Seasoned wood, strong joinery, careful finishing. No shortcuts — ever.",
              },
              {
                icon: HeartHandshake,
                t: "Trust Before Payment",
                d: "Cash on delivery, honest photos, and a team that picks up the phone.",
              },
              {
                icon: Target,
                t: "On-Time Delivery",
                d: "Committed timelines for both online orders and interior projects.",
              },
            ].map((v, i) => (
              <Reveal key={v.t} delay={i * 0.07}>
                <div className="h-full rounded-3xl border bg-card p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
                    <v.icon size={24} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{v.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
