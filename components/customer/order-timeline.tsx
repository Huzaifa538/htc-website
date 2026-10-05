/**
 * Order status timeline: Pending → Confirmed → Shipped → Delivered,
 * with a Cancelled terminal state.
 */
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const STEPS: OrderStatus[] = ["Pending", "Confirmed", "Shipped", "Delivered"];

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "Cancelled") {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
        This order was cancelled. Contact us on WhatsApp if you need help.
      </div>
    );
  }
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className={cn("flex-1", i < STEPS.length - 1 && "pr-1")}>
            <div className="flex items-center">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done
                    ? "bg-green-600 text-white"
                    : active
                      ? "bg-[#D21F26] text-white ring-4 ring-[#D21F26]/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check size={15} /> : i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded",
                    i < current ? "bg-green-600" : "bg-muted"
                  )}
                />
              )}
            </div>
            <p
              className={cn(
                "mt-1.5 text-[11px] font-bold sm:text-xs",
                active ? "text-[#D21F26]" : "text-muted-foreground"
              )}
            >
              {step}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
        status === "Delivered" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
        status === "Shipped" && "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        status === "Confirmed" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        status === "Pending" && "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
        status === "Cancelled" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {status}
    </span>
  );
}
