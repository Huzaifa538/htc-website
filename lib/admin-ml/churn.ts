/**
 * Customer churn — wo customers jo 60+ din se order nahi kar rahe.
 *
 * Har customer ka aakhri order dekho; jitne din guzar gaye us
 * hisaab se "win-back" priority lagao. Sirf wo customers jin
 * ka kam-az-kam 1 order hai.
 */
import type { AppUser, Order, WithId } from "../types";
import { DAY, isCounted, toMillis } from "./utils";

export interface ChurnedCustomer {
  userId: string;
  name: string;
  email: string;
  /** aakhri order ko kitne din ho gaye */
  daysInactive: number;
  /** kul kitne orders kiye */
  orderCount: number;
  /** kul kitna kharcha kiya (PKR) */
  totalSpent: number;
}

export function churnedCustomers(
  users: WithId<AppUser>[],
  orders: WithId<Order>[],
  inactiveDays = 60
): ChurnedCustomer[] {
  const cutoff = Date.now() - inactiveDays * DAY;
  const byUser = new Map<string, WithId<Order>[]>();
  for (const o of orders) {
    if (!isCounted(o)) continue;
    if (!o.userId) continue;
    const list = byUser.get(o.userId) ?? [];
    list.push(o);
    byUser.set(o.userId, list);
  }

  const out: ChurnedCustomer[] = [];
  for (const [userId, list] of Array.from(byUser.entries())) {
    const lastMs = Math.max(...list.map((o) => toMillis(o.createdAt)));
    if (lastMs === 0 || lastMs >= cutoff) continue;
    const user = users.find((u) => u.id === userId);
    out.push({
      userId,
      name: user?.name ?? "—",
      email: user?.email ?? "—",
      daysInactive: Math.floor((Date.now() - lastMs) / DAY),
      orderCount: list.length,
      totalSpent: list.reduce((s, o) => s + (o.total ?? 0), 0),
    });
  }
  // sab se zyada kharcha karne wale pehle — unko wapas lana sab se qeemti
  return out.sort((a, b) => b.totalSpent - a.totalSpent);
}
