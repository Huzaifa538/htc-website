/**
 * Star rating display (read-only, supports fractional fill).
 */
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            size={size}
            className={
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted-foreground/30"
            }
          />
        );
      })}
    </span>
  );
}

/** Interactive star picker for review forms. */
export function StarPicker({
  value,
  onChange,
  size = 24,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={`${v} star${v > 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={size}
            className={
              v <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </span>
  );
}
