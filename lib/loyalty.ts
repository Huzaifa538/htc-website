/**
 * Loyalty points — earn on every order, spend as discount.
 *
 * Simple rule the shop can explain in one line:
 *   Rs 100 spent = 1 point, and 1 point = Rs 1 off your next order.
 *
 * Points are stored on the user's `users/{uid}` doc as `loyaltyPoints`.
 * Earning and redemption both happen server-side in /api/orders, so the
 * client never gets to invent points.
 */

/** Spend this many rupees to earn 1 point. */
export const RUPEES_PER_POINT_EARNED = 100;

/** Each point is worth this many rupees at checkout. */
export const RUPEES_PER_POINT_VALUE = 1;

/** Points earned for a paid order total (whole points only). */
export function pointsForAmount(total: number): number {
  if (!(total > 0)) return 0;
  return Math.floor(total / RUPEES_PER_POINT_EARNED);
}

/** Rupee discount a points balance is worth. */
export function discountForPoints(points: number): number {
  if (!(points > 0)) return 0;
  return Math.floor(points) * RUPEES_PER_POINT_VALUE;
}

/**
 * How many of the customer's points can actually be used on this order.
 * Capped so the discount never exceeds the amount being paid.
 */
export function maxUsablePoints(subtotal: number, balance: number): number {
  if (!(subtotal > 0) || !(balance > 0)) return 0;
  return Math.min(Math.floor(balance), Math.floor(subtotal / RUPEES_PER_POINT_VALUE));
}

/** "1,250 points" — locale-formatted for display. */
export function formatPoints(points: number): string {
  return Math.floor(points).toLocaleString("en-PK");
}
