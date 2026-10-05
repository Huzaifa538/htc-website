/**
 * Tests for the pure cart-totals math in lib/cart-totals.ts.
 *
 * These guard the exact pricing rules the storefront checkout depends on:
 * subtotal, coupon discounts, free-shipping threshold, and grand total.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING,
  cartDiscount,
  cartShipping,
  cartSubtotal,
  cartTotals,
} from "@/lib/cart-totals";

const lines = [
  { unitPrice: 1200, qty: 2 }, // 2400
  { unitPrice: 350, qty: 3 }, // 1050
]; // subtotal = 3450

describe("cartSubtotal", () => {
  it("sums unitPrice × qty across lines", () => {
    expect(cartSubtotal(lines)).toBe(3450);
  });

  it("is 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartDiscount", () => {
  it("returns 0 without a coupon", () => {
    expect(cartDiscount(3450, null)).toBe(0);
  });

  it("applies percent coupons, rounded to whole rupees", () => {
    expect(cartDiscount(3450, { type: "percent", value: 10 })).toBe(345);
    // 3333 × 15% = 499.95 → 500
    expect(cartDiscount(3333, { type: "percent", value: 15 })).toBe(500);
  });

  it("applies flat coupons but never more than the subtotal", () => {
    expect(cartDiscount(3450, { type: "flat", value: 500 })).toBe(500);
    expect(cartDiscount(300, { type: "flat", value: 500 })).toBe(300);
  });
});

describe("cartShipping", () => {
  it("is free for an empty cart", () => {
    expect(cartShipping(0, 0, 0)).toBe(0);
  });

  it("is free when the discounted subtotal reaches the threshold", () => {
    expect(
      cartShipping(2, DEFAULT_FREE_SHIPPING_THRESHOLD, 0)
    ).toBe(0);
    expect(
      cartShipping(2, DEFAULT_FREE_SHIPPING_THRESHOLD + 1000, 1000)
    ).toBe(0);
  });

  it("charges the flat fee below the threshold", () => {
    expect(cartShipping(2, 3450, 0)).toBe(FLAT_SHIPPING);
  });

  it("respects a custom threshold (e.g. from site settings)", () => {
    expect(cartShipping(1, 4000, 0, 5000)).toBe(FLAT_SHIPPING);
    expect(cartShipping(1, 6000, 0, 5000)).toBe(0);
  });
});

describe("cartTotals", () => {
  it("combines subtotal, discount, shipping, and total", () => {
    const t = cartTotals(lines, { type: "percent", value: 10 });
    expect(t.subtotal).toBe(3450);
    expect(t.discount).toBe(345);
    expect(t.shipping).toBe(FLAT_SHIPPING);
    expect(t.total).toBe(3450 - 345 + FLAT_SHIPPING);
  });

  it("never returns a negative total", () => {
    const t = cartTotals([{ unitPrice: 100, qty: 1 }], {
      type: "flat",
      value: 100,
    });
    expect(t.total).toBeGreaterThanOrEqual(0);
  });

  it("gives free shipping on a large order", () => {
    const t = cartTotals([{ unitPrice: 60000, qty: 1 }], null);
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(60000);
  });
});
