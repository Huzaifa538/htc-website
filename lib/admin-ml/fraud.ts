/**
 * Fraud detection — mushkuk orders ko flag karo.
 *
 * Simple rule-based scoring (koi ML model nahi, lekin admin ke
 * liye kaafi): bara COD order, bilkul naya account, ghair-mamooli
 * bara total — har rule ka wazan jurta hai, score 50+ ho to review.
 */
import type { AppUser, Order, WithId } from "../types";
import { DAY, isCounted, toMillis } from "./utils";

export interface FraudFlag {
  orderId: string;
  total: number;
  paymentMethod: string;
  customerName: string;
  /** 0–100 */
  riskScore: number;
  reasons: string[];
}

const LARGE_COD = 150_000; // is se bara COD = khatra
const NEW_ACCOUNT_ORDER = 50_000; // naya account + itna bara order
const HUGE_ORDER = 500_000; // hamesha review karo

export function fraudFlags(
  orders: WithId<Order>[],
  users: WithId<AppUser>[]
): FraudFlag[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const flags: FraudFlag[] = [];

  for (const o of orders) {
    if (!isCounted(o)) continue;
    if (o.status !== "Pending" && o.status !== "Confirmed") continue;
    const reasons: string[] = [];
    let score = 0;
    const total = o.total ?? 0;

    if (o.paymentMethod === "COD" && total >= LARGE_COD) {
      score += 45;
      reasons.push(`Bara COD order (Rs ${Math.round(total).toLocaleString()})`);
    }
    if (total >= HUGE_ORDER) {
      score += 40;
      reasons.push("Ghair-mamooli bara total — manual review karein");
    }

    const user = o.userId ? userById.get(o.userId) : undefined;
    if (user) {
      const ageMs = toMillis(o.createdAt) - toMillis(user.createdAt);
      if (ageMs >= 0 && ageMs < 3 * DAY && total >= NEW_ACCOUNT_ORDER) {
        score += 35;
        reasons.push("Naya account + bara order");
      }
    } else if (total >= NEW_ACCOUNT_ORDER) {
      // guest / account ke baghair bara order
      score += 20;
      reasons.push("Account ke baghair bara order");
    }

    // phone number ajeeb ho (bahut chhota ya digits na hon)
    const phone = (o.address?.phone ?? "").replace(/\D/g, "");
    if (phone.length > 0 && phone.length < 10) {
      score += 15;
      reasons.push("Phone number mukammal nahi lagta");
    }

    if (score >= 50) {
      flags.push({
        orderId: o.id,
        total,
        paymentMethod: o.paymentMethod,
        customerName: o.address?.name ?? "—",
        riskScore: Math.min(100, score),
        reasons,
      });
    }
  }
  return flags.sort((a, b) => b.riskScore - a.riskScore);
}
