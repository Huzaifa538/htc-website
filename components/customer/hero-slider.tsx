/**
 * Hero slider: heroSlides collection (≤15), autoplay, dots, arrows,
 * mobile swipe, editable title/subtitle/CTA. Graceful fallback hero when
 * Firebase isn't configured or no slides exist.
 *
 * 3D PARALLAX: layers (background image, floating badges, headline text)
 * move at different rates via CSS 3D transforms. Mouse-move on desktop,
 * touch-drag on mobile, gentle auto-drift when idle. Transform-only,
 * rAF-throttled, will-change hints, honors prefers-reduced-motion.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { useHeroSlides } from "@/components/customer/data-hooks";
import { tsMillis } from "@/components/customer/product-utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const AUTOPLAY_MS = 6000;
/** Max layer travel in px at full deflection (scaled per-layer by depth). */
const PARALLAX_RANGE = 46;

function FallbackHero() {
  return (
    <div className="relative flex h-[70vh] min-h-[480px] items-center overflow-hidden bg-stone-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#D21F26_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,#7C4A21_0%,transparent_50%)] opacity-60" />
      <div className="container relative z-10 text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl"
        >
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D21F26] shadow-[0_0_8px_rgba(210,31,38,0.9)]" />
            Hammer Trading
          </p>
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            <span className="bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent">
              Quality Door Hardware &amp; Fittings
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-white/80">
            Locks, handles, hinges &amp; more — door hardware, epoxy resin and
            hand tools delivered across Pakistan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D21F26] to-[#a8161c] px-8 py-3.5 font-bold text-white shadow-[0_12px_32px_-8px_rgba(210,31,38,0.7)] transition-all hover:shadow-[0_16px_40px_-8px_rgba(210,31,38,0.85)]"
            >
              Shop Now
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 font-bold text-white transition hover:bg-white/10"
            >
              Our Services
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Parallax driver: tracks pointer/touch, applies per-layer translate3d via
 * rAF, plus a gentle idle auto-drift. All DOM writes are transform-only.
 */
function useHeroParallax(containerRef: React.RefObject<HTMLDivElement | null>) {
  const layersRef = useRef<Array<{ el: HTMLElement; depth: number }>>([]);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idle = useRef(true);
  const enabled = useRef(false);

  const register = useCallback((el: HTMLElement | null, depth: number) => {
    if (!el) return;
    // Dedupe re-registrations; drop unmounted layers each tick.
    if (!layersRef.current.some((l) => l.el === el)) {
      layersRef.current.push({ el, depth });
    }
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    enabled.current = !reduced;
    if (!enabled.current) return;

    const tick = (t: number) => {
      // Ease current toward target.
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;

      // Gentle auto-drift when idle.
      let dx = current.current.x;
      let dy = current.current.y;
      if (idle.current) {
        dx += Math.sin(t / 2600) * 0.16;
        dy += Math.cos(t / 3400) * 0.12;
      }

      for (const { el, depth } of layersRef.current) {
        if (!el.isConnected) continue;
        const x = (-dx * PARALLAX_RANGE * depth).toFixed(2);
        const y = (-dy * PARALLAX_RANGE * depth).toFixed(2);
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const poke = useCallback((nx: number, ny: number) => {
    if (!enabled.current) return;
    target.current.x = Math.max(-0.5, Math.min(0.5, nx));
    target.current.y = Math.max(-0.5, Math.min(0.5, ny));
    idle.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idle.current = true;
      target.current.x = 0;
      target.current.y = 0;
    }, 2800);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      poke((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    },
    [containerRef, poke]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = containerRef.current;
      const t = e.touches[0];
      if (!el || !t) return;
      const r = el.getBoundingClientRect();
      poke((t.clientX - r.left) / r.width - 0.5, (t.clientY - r.top) / r.height - 0.5);
    },
    [containerRef, poke]
  );

  return { register, onMouseMove, onTouchMove };
}

export function HeroSlider() {
  const { items, loading, configured } = useHeroSlides();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { register, onMouseMove, onTouchMove } = useHeroParallax(containerRef);

  const slides = [...items]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || tsMillis(b.createdAt) - tsMillis(a.createdAt))
    .slice(0, 15);

  const go = useCallback(
    (dir: 1 | -1) =>
      setIndex((i) => (i + dir + slides.length) % Math.max(slides.length, 1)),
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, slides.length, go]);

  useEffect(() => setIndex(0), [slides.length]);

  if (loading && configured) {
    return <Skeleton className="h-[70vh] min-h-[480px] w-full rounded-none" />;
  }
  if (slides.length === 0) return <FallbackHero />;

  const slide = slides[index]!;

  return (
    <div
      ref={containerRef}
      className="relative h-[70vh] min-h-[480px] overflow-hidden bg-stone-950 [perspective:1200px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onMouseMove={onMouseMove}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchMove={onTouchMove}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          {/* Layer 1 — background image (deepest, drifts least) */}
          <div
            ref={(el) => register(el, 0.35)}
            className="absolute -inset-6 will-change-transform"
          >
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              priority={index === 0}
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />

          {/* Layer 2 — floating badges (closest, drift most) */}
          <div
            ref={(el) => register(el, 1)}
            className="absolute inset-0 will-change-transform"
          >
            <div className="absolute right-[8%] top-[18%] hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md sm:flex">
              <Truck size={14} className="text-[#D21F26]" /> Free Delivery
            </div>
            <div className="absolute bottom-[22%] right-[14%] hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md lg:flex">
              <BadgeCheck size={14} className="text-emerald-400" /> Premium Quality
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Layer 3 — headline text (mid depth) */}
      <div className="container relative z-10 flex h-full items-center">
        <div
          ref={(el) => register(el, 0.6)}
          className="will-change-transform"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id + "-text"}
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl text-white"
            >
              {/* Stylish kicker badge */}
              <motion.span
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-white backdrop-blur-md"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#D21F26] shadow-[0_0_8px_rgba(210,31,38,0.9)]" />
                Hammer Trading
              </motion.span>
              <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl [text-shadow:0_4px_32px_rgba(0,0,0,0.55)]">
                <span className="bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent">
                  {slide.title}
                </span>
              </h1>
              {slide.subtitle && (
                <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-white/80 [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]">
                  {slide.subtitle}
                </p>
              )}
              {slide.ctaText && (
                <Link
                  href={slide.ctaLink || "/shop"}
                  className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D21F26] to-[#a8161c] px-8 py-3.5 font-bold text-white shadow-[0_12px_32px_-8px_rgba(210,31,38,0.7)] transition-all hover:shadow-[0_16px_40px_-8px_rgba(210,31,38,0.85)]"
                >
                  {slide.ctaText}
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-[#D21F26]"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-[#D21F26]"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-2.5 rounded-full transition-all",
                i === index ? "w-8 bg-[#D21F26]" : "w-2.5 bg-white/50 hover:bg-white"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
