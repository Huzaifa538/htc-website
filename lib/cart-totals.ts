/**
 * Pure cart-totals math.
 *
 * Extracted from useHydratedCart so the pricing logic is unit-testable
 * without React or Firestore. The hook in
 * components/customer/use-hydrated-cart.ts consumes these — both must stay
 * in sync (tests guard the math here).
 */
import type { CartLine, CouponState } from "./store/cart";

/** Flat delivery fee (PKR) when the free-shipping threshold isn't met. */
export const FLAT_SHIPPING = 350;

/** Default free-shipping threshold (PKR); overridable via site settings. */
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 50000;

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

type LineInput = Pick<CartLine, "unitPrice" | "qty">;

/** Sum of unitPrice × qty across lines. */
export function cartSubtotal(lines: LineInput[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

/**
 * Coupon discount on a subtotal. Percent coupons round to whole rupees;
 * flat coupons never exceed the subtotal.
 */
export function cartDiscount(
  subtotal: number,
  coupon: Pick<CouponState, "type" | "value"> | null
): number {
  if (!coupon) return 0;
  if (coupon.type === "percent") {
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(coupon.value, subtotal);
}

/**
 * Shipping fee: free when the cart is empty (nothing to ship) or the
 * discounted subtotal reaches the threshold; otherwise FLAT_SHIPPING.
 */
export function cartShipping(
  lineCount: number,
  subtotal: number,
  discount: number,
  threshold: number = DEFAULT_FREE_SHIPPING_THRESHOLD
): number {
  if (lineCount === 0 || subtotal - discount >= threshold) return 0;
  return FLAT_SHIPPING;
}

/** Full totals object from lines + coupon + threshold. */
export function cartTotals(
  lines: LineInput[],
  coupon: Pick<CouponState, "type" | "value"> | null,
  threshold: number = DEFAULT_FREE_SHIPPING_THRESHOLD
): CartTotals {
  const subtotal = cartSubtotal(lines);
  const discount = cartDiscount(subtotal, coupon);
  const shipping = cartShipping(lines.length, subtotal, discount, threshold);
  const total = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, total };
}
