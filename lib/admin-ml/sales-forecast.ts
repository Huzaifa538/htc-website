/**
 * Sales forecast — agle 30 din ki andazan sales.
 *
 * Pichle 60 din ke roz-ke-revenue par simple linear regression
 * lagti hai; slope se trend (up/down) aur agle 30 din ka kul
 * revenue nikalta hai. Data kam ho to seedha average use hota hai.
 */
import type { Order, WithId } from "../types";
import { dailyRevenue } from "./utils";

export interface SalesForecast {
  /** agle 30 din ka andazan kul revenue (PKR) */
  predicted30d: number;
  /** roz ka ausat revenue, pichle 60 din (PKR) */
  avgDaily: number;
  /** trend: "up" | "down" | "flat" */
  trend: "up" | "down" | "flat";
  /** trend kitne % ka hai (mahine-dar-mahina andaza) */
  trendPct: number;
  /** data kitne din ka mila */
  daysOfData: number;
}

export function forecastSales(
  orders: WithId<Order>[],
  windowDays = 60
): SalesForecast {
  const days = dailyRevenue(orders, windowDays).filter((d) => d.revenue > 0);
  const n = days.length;
  if (n === 0) {
    return { predicted30d: 0, avgDaily: 0, trend: "flat", trendPct: 0, daysOfData: 0 };
  }

  const avgDaily = days.reduce((s, d) => s + d.revenue, 0) / n;

  // linear regression: x = day index, y = revenue
  let slope = 0;
  let trend: SalesForecast["trend"] = "flat";
  let trendPct = 0;
  if (n >= 7) {
    const meanX = (n - 1) / 2;
    const meanY = avgDaily;
    let num = 0;
    let den = 0;
    days.forEach((d, i) => {
      num += (i - meanX) * (d.revenue - meanY);
      den += (i - meanX) * (i - meanX);
    });
    slope = den > 0 ? num / den : 0;
    const monthlyChange = avgDaily > 0 ? (slope * 30 * 100) / avgDaily : 0;
    trendPct = Math.round(monthlyChange);
    trend = monthlyChange > 5 ? "up" : monthlyChange < -5 ? "down" : "flat";
  }

  // agle 30 din: aakhri value + slope, negative na ho
  const last = days[n - 1].revenue;
  let predicted30d = 0;
  for (let i = 1; i <= 30; i++) {
    predicted30d += Math.max(0, last + slope * i);
  }
  if (n < 7) predicted30d = avgDaily * 30;

  return {
    predicted30d: Math.round(predicted30d),
    avgDaily: Math.round(avgDaily),
    trend,
    trendPct,
    daysOfData: n,
  };
}
