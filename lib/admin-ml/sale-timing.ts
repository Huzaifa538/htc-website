/**
 * Best sale timing — order history se nikalo ke flash sale
 * kis din aur kis waqt lagani chahiye.
 *
 * Orders ko hafte ke din (weekday) aur din ke hisse (morning /
 * afternoon / evening / night) mein baant kar revenue dekho.
 */
import type { Order, WithId } from "../types";
import { isCounted, toMillis } from "./utils";

export interface SaleTiming {
  /** 0=Sunday … 6=Saturday */
  bestWeekday: number;
  bestWeekdayRevenue: number;
  /** e.g. "evening" */
  bestSlot: string;
  bestSlotRevenue: number;
  /** har weekday ka kul revenue */
  weekdayRevenue: number[];
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const UR_WEEKDAYS = [
  "Itwaar",
  "Peer",
  "Mangal",
  "Budh",
  "Jumeraat",
  "Jumma",
  "Hafta",
];

export function weekdayName(day: number, lang: "en" | "ur" = "en"): string {
  return lang === "ur" ? UR_WEEKDAYS[day] : WEEKDAYS[day];
}

/** hour (0-23) ko din ke hisse mein badlo */
export function slotOf(hour: number): string {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function bestSaleTiming(orders: WithId<Order>[]): SaleTiming | null {
  const weekdayRevenue = [0, 0, 0, 0, 0, 0, 0];
  const slotRevenue: Record<string, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };
  let counted = 0;

  for (const o of orders) {
    if (!isCounted(o)) continue;
    const ms = toMillis(o.createdAt);
    if (ms === 0) continue;
    const d = new Date(ms);
    weekdayRevenue[d.getDay()] += o.total ?? 0;
    slotRevenue[slotOf(d.getHours())] += o.total ?? 0;
    counted++;
  }
  if (counted < 5) return null; // itna kam data ke mashwara bekaar

  let bestWeekday = 0;
  for (let i = 1; i < 7; i++) {
    if (weekdayRevenue[i] > weekdayRevenue[bestWeekday]) bestWeekday = i;
  }
  let bestSlot = "evening";
  for (const s of Object.keys(slotRevenue)) {
    if (slotRevenue[s] > slotRevenue[bestSlot]) bestSlot = s;
  }

  return {
    bestWeekday,
    bestWeekdayRevenue: Math.round(weekdayRevenue[bestWeekday]),
    bestSlot,
    bestSlotRevenue: Math.round(slotRevenue[bestSlot]),
    weekdayRevenue: weekdayRevenue.map(Math.round),
  };
}
