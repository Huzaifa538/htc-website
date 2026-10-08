/**
 * BeforeAfterSlider — drag-to-compare image slider for the portfolio page.
 * The "after" photo is the base layer; the "before" photo is clipped to the
 * left of the handle. Works with mouse + touch via pointer events.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  before: string;
  after: string;
  alt: string;
  className?: string;
}

export function BeforeAfterSlider({ before, after, alt, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // percent from the left
  const [dragging, setDragging] = useState(false);

  const moveTo = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        setDragging(true);
        moveTo(e.clientX);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging) moveTo(e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className={cn(
        "group relative aspect-[16/10] cursor-ew-resize select-none overflow-hidden rounded-3xl border bg-muted",
        dragging && "cursor-grabbing",
        className
      )}
    >
      {/* After (base layer) */}
      <Image
        src={after}
        alt={`${alt} — after`}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="pointer-events-none object-cover"
        draggable={false}
      />
      {/* Before (clipped to the left of the handle) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Image
          src={before}
          alt={`${alt} — before`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* Handle line */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]"
        style={{ left: `${pos}%` }}
      />
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#D21F26] shadow-xl transition-transform",
          dragging ? "scale-110" : "group-hover:scale-105"
        )}
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRight size={22} />
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
        Before
      </span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-[#D21F26] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
        After
      </span>
    </div>
  );
}
