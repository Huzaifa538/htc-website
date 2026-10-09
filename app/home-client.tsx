/**
 * Home — hero slider, featured categories, new arrivals, best sellers,
 * featured services, projects preview, video gallery preview,
 * testimonials, why-choose-us, newsletter.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck,
  Headset,
  Play,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { useLanguage } from "@/lib/i18n";
import { SiteShell } from "@/components/customer/site-shell";
import { HeroSlider } from "@/components/customer/hero-slider";
import { FlashSaleBanner } from "@/components/flash-sale-banner";
import { ProductCard } from "@/components/customer/product-card";
import { Reveal, SectionHeading, AnimatedCounter } from "@/components/customer/reveal";
import { Stars } from "@/components/customer/stars";
import {
  EmptyState,
  ProductGridSkeleton,
} from "@/components/customer/skeletons";
import {
  useAboutContent,
  useCategories,
  useGalleryVideos,
  useProducts,
  useProjects,
  useServices,
  useSiteSettings,
} from "@/components/customer/data-hooks";
import { tsMillis } from "@/components/customer/product-utils";
import type { SiteSettings } from "@/lib/types";

interface Testimonial {
  name: string;
  text: string;
  rating: number;
}

function useTestimonials() {
  const { t } = useLanguage();
  const { settings } = useSiteSettings();
  const extra = (settings as (SiteSettings & { testimonials?: Testimonial[] }) | null)
    ?.testimonials;
  if (Array.isArray(extra) && extra.length > 0) return extra;
  return t.homeExtra.testimonials;
}

function Categories() {
  const { t } = useLanguage();
  const { items, loading, configured } = useCategories();
  const cats = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 8);
  if (loading) return <ProductGridSkeleton count={4} />;
  if (!configured || cats.length === 0) {
    return (
      <EmptyState
        title={t.home.categoriesSoon}
        description={t.home.categoriesSoonSub}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {cats.map((c, i) => (
        <Reveal key={c.id} delay={i * 0.06}>
          <Link
            href={`/shop?category=${c.id}`}
            className="group relative block overflow-hidden rounded-3xl"
          >
            <div className="relative aspect-[4/5]">
              <Image
                src={c.image || "/logo.png"}
                alt={c.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className="font-display text-lg font-extrabold text-white">
                {c.name}
              </h3>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/80 transition group-hover:gap-2 group-hover:text-white">
                {t.home.shopNow} <ArrowRight size={15} className="rtl:rotate-180" />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function NewArrivals() {
  const { t } = useLanguage();
  const { products, loading, configured } = useProducts();
  const items = [...products]
    .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt))
    .slice(0, 8);
  if (loading) return <ProductGridSkeleton count={8} />;
  if (!configured || items.length === 0) {
    return (
      <EmptyState
        title={t.home.arrivalsSoon}
        description={t.home.arrivalsSoonSub}
        actionLabel={t.home.browseShop}
        actionHref="/shop"
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 0.06}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}

function BestSellers() {
  const { t } = useLanguage();
  const { products, loading, configured } = useProducts();
  const items = [...products]
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 8);
  if (loading) return <ProductGridSkeleton count={8} />;
  if (!configured || items.length === 0) {
    return (
      <EmptyState
        title={t.home.sellersSoon}
        description={t.home.sellersSoonSub}
        actionLabel={t.home.browseShop}
        actionHref="/shop"
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 0.06}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}

function FeaturedServices() {
  const { t } = useLanguage();
  const { items, loading, configured } = useServices();
  const list = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 4);
  if (loading) return <ProductGridSkeleton count={4} />;
  if (!configured || list.length === 0) {
    return (
      <EmptyState
        title={t.home.servicesSoon}
        description={t.home.servicesSoonSub}
        actionLabel={t.home.viewServices}
        actionHref="/services"
      />
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((s, i) => (
        <Reveal key={s.id} delay={i * 0.07}>
          <Link
            href={`/services/${s.slug || s.id}`}
            className="group block overflow-hidden rounded-3xl border bg-card transition hover:shadow-xl"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={s.image || "/logo.png"}
                alt={s.name}
                fill
                sizes="(max-width: 640px) 100vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-bold">{s.name}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                {s.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#D21F26]">
                {t.home.getQuote} <ArrowRight size={15} className="rtl:rotate-180" />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function ProjectsPreview() {
  const { t } = useLanguage();
  const { items, loading, configured } = useProjects();
  const featured = items
    .filter((p) => p.featured)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const show = (featured.length > 0 ? featured : [...items]).slice(0, 3);
  if (loading) return <ProductGridSkeleton count={3} />;
  if (!configured || show.length === 0) {
    return (
      <EmptyState
        title={t.home.projectsSoon}
        description={t.home.projectsSoonSub}
        actionLabel={t.home.viewProjects}
        actionHref="/projects"
      />
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {show.map((p, i) => (
        <Reveal key={p.id} delay={i * 0.07}>
          <Link
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span
                className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white ${
                  p.status === "Completed"
                    ? "bg-green-600"
                    : p.status === "Ongoing"
                      ? "bg-amber-500"
                      : "bg-sky-600"
                }`}
              >
                {p.status}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className="font-display text-lg font-extrabold text-white">{p.title}</h3>
              <p className="text-sm text-white/70">{p.location}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-[#D21F26]"
                  style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                />
              </div>
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function VideosPreview() {
  const { t } = useLanguage();
  const { items, loading, configured } = useGalleryVideos();
  const list = [...items]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 4);
  if (loading || !configured || list.length === 0) return null;
  return (
    <section className="container mt-20">
      <SectionHeading
        eyebrow={t.home.watch}
        title={t.home.videoGallery}
        subtitle={t.home.videoGallerySub}
      />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {list.map((v, i) => (
          <Reveal key={v.id} delay={i * 0.06}>
            <Link href="/gallery" className="group relative block overflow-hidden rounded-3xl">
              <div className="relative aspect-video">
                <Image
                  src={v.thumbnailUrl || "/logo.png"}
                  alt={v.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D21F26] text-white shadow-xl transition group-hover:scale-110">
                    <Play size={22} className="ml-0.5 fill-current" />
                  </span>
                </div>
              </div>
              <p className="mt-2.5 truncate px-1 text-sm font-semibold">{v.title}</p>
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 rounded-full border px-7 py-3 font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
        >
          {t.home.viewFullGallery} <ArrowRight size={16} className="rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}

function Testimonials() {
  const { t } = useLanguage();
  const list = useTestimonials();
  return (
    <section className="mt-20 bg-[#FBF3E4] py-16 dark:bg-stone-950/60">
      <div className="container">
        <SectionHeading
          eyebrow={t.home.reviews}
          title={t.home.lovedByHomes}
        />
        <div className="grid gap-5 md:grid-cols-3">
          {list.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <motion.figure
                whileHover={{ y: -6 }}
                className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm dark:bg-stone-900"
              >
                <Stars rating={t.rating} size={16} />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D21F26]/10 font-display font-extrabold text-[#D21F26]">
                    {t.name.charAt(0)}
                  </span>
                  <span className="font-semibold">{t.name}</span>
                </figcaption>
              </motion.figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const WHY_ICONS = [Award, Truck, BadgeCheck, Headset];

function Stats() {
  const { t } = useLanguage();
  const { about } = useAboutContent();
  // Prefer the CMS-managed stats (admin About page); fall back to defaults.
  const stats = (about?.stats?.length ? about.stats : t.homeExtra.defaultStats).map((s) => {
    const m = s.value.replace(/,/g, "").match(/[\d.]+/);
    return {
      label: s.label,
      value: m ? parseFloat(m[0]) : 0,
      suffix: s.value.replace(/[\d.,\s]/g, "") || "+",
    };
  });
  return (
    <section className="container mt-20">
      <div className="grid grid-cols-2 gap-6 rounded-3xl bg-stone-950 p-8 text-white sm:p-12 lg:grid-cols-4 dark:bg-stone-900">
        {stats.map((s) => (
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
  );
}

function Newsletter() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error(t.home.validEmail);
      return;
    }
    setBusy(true);
    try {
      if (db && isFirebaseConfigured()) {
        await addDoc(collection(db, "newsletters"), {
          email: value,
          createdAt: serverTimestamp(),
        });
      }
      toast.success(t.home.subscribed);
      setEmail("");
    } catch {
      toast.error(t.home.subscribeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container mt-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-[#D21F26] px-8 py-14 text-center text-white sm:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              {t.home.newsletterTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              {t.home.newsletterSub}
            </p>
            <form
              onSubmit={submit}
              className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row sm:items-center sm:rounded-full sm:bg-white sm:p-1.5"
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t.home.yourEmail}
                className="w-full rounded-full bg-white px-4 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 sm:bg-transparent sm:py-0"
              />
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {busy ? "…" : t.home.subscribe}
              </button>
            </form>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  return (
    <SiteShell>
      <FlashSaleBanner />
      <HeroSlider />

      <section className="container mt-16">
        <SectionHeading
          eyebrow={t.home.collections}
          title={t.home.shopByCategory}
          subtitle={t.home.shopByCategorySub}
        />
        <Categories />
      </section>

      <section className="container mt-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
              {t.home.freshStock}
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.newArrivals}
            </h2>
          </div>
          <Link
            href="/shop?sort=newest"
            className="hidden items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-bold transition hover:border-[#D21F26] hover:text-[#D21F26] sm:inline-flex"
          >
            {t.home.viewAll} <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
        </div>
        <NewArrivals />
      </section>

      <section className="container mt-20">
        <SectionHeading
          eyebrow={t.home.customerFavourites}
          title={t.home.bestSellers}
          subtitle={t.home.bestSellersSub}
        />
        <BestSellers />
      </section>

      <section className="container mt-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
              {t.home.interiorDesign}
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.ourServices}
            </h2>
          </div>
          <div className="hidden items-center gap-2 sm:inline-flex">
            <Link
              href="/book-consultation"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#D21F26] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#a8161c]"
            >
              <CalendarCheck size={15} /> {t.home.bookConsultation}
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
            >
              {t.home.allServices} <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
        <FeaturedServices />
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/book-consultation"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#D21F26] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#a8161c]"
          >
            <CalendarCheck size={15} /> {t.home.bookConsultation}
          </Link>
        </div>
      </section>

      <section className="container mt-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
              {t.home.transformations}
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.recentProjects}
            </h2>
          </div>
          <Link
            href="/projects"
            className="hidden items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-bold transition hover:border-[#D21F26] hover:text-[#D21F26] sm:inline-flex"
          >
            {t.home.allProjects} <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
        </div>
        <ProjectsPreview />
      </section>

      <VideosPreview />
      <Testimonials />
      <Stats />

      <section className="container mt-20">
        <SectionHeading
          eyebrow={t.home.whyHtc}
          title={t.home.whyChoose}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.why.map((w, i) => {
            const Icon = WHY_ICONS[i] ?? Award;
            return (
              <Reveal key={w.title} delay={i * 0.07}>
                <div className="h-full rounded-3xl border bg-card p-6 transition hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
                    <Icon size={24} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {w.text}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <Newsletter />
    </SiteShell>
  );
}
