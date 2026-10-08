/**
 * Flash Sale banner — countdown strip shown on the storefront while a
 * flash sale is live. "FLASH SALE! 20% OFF — ends in 04:23:11".
 *
 * Picks the active sale itself (enabled + inside its time window), ticks
 * every second, and hides when nothing is active. Premium look: deep red
 * gradient, glowing timer chips, subtle animated shine.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import Link from "next/link";
import { useCollection } from "@/components/admin/firebase";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { FlashSale, WithId } from "@/lib/types";
import { pickActiveFlashSale, splitCountdown, tsMillis } from "@/lib/flash-sale";

function useActiveFlashSale(): WithId<FlashSale> | null {
  const { data } = useCollection<FlashSale>(COLLECTIONS.flashSales);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => pickActiveFlashSale(data ?? [], now), [data, now]);
}

export { useActiveFlashSale };

function TimeChip({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="min-w-11 rounded-lg bg-black/35 px-2 py-1 text-center font-display text-lg font-extrabold tabular-nums text-white shadow-inner">
        {value}
      </span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {label}
      </span>
    </span>
  );
}

export function FlashSaleBanner() {
  const sale = useActiveFlashSale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!sale) return null;

  const remaining = tsMillis(sale.endsAt) - now;
  const { hh, mm, ss } = splitCountdown(remaining);

  return (
    <motion.div
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative overflow-hidden bg-gradient-to-r from-[#B31217] via-[#D21F26] to-[#B31217]"
    >
      {/* animated shine sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
        animate={{ x: ["-120%", "420%"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <Link
        href="/shop"
        className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2.5"
      >
        <span className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-white sm:text-base">
          <Zap size={18} className="fill-yellow-300 text-yellow-300" />
          Flash Sale! {sale.discountPct}% Off
        </span>
        <span className="hidden text-sm font-medium text-white/85 sm:inline">
          {sale.title}
        </span>
        <span className="flex items-center gap-1.5">
          <TimeChip value={hh} label="hrs" />
          <span className="font-extrabold text-white/80">:</span>
          <TimeChip value={mm} label="min" />
          <span className="font-extrabold text-white/80">:</span>
          <TimeChip value={ss} label="sec" />
        </span>
        <span className="rounded-full bg-white px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide text-[#D21F26] shadow">
          Shop now
        </span>
      </Link>
    </motion.div>
  );
}
