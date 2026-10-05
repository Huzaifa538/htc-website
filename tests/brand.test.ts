/**
 * Tests for brand routing (lib/brand.ts): shop routes resolve to the MTR
 * store brand, everything else to HTC.
 */
import { describe, expect, it } from "vitest";
import { brandForRoute, isShopRoute } from "@/lib/brand";

describe("isShopRoute", () => {
  it("matches the storefront prefixes exactly and as prefixes", () => {
    expect(isShopRoute("/shop")).toBe(true);
    expect(isShopRoute("/product/abc")).toBe(true);
    expect(isShopRoute("/cart")).toBe(true);
    expect(isShopRoute("/checkout/success")).toBe(true);
    expect(isShopRoute("/wishlist")).toBe(true);
  });

  it("does not match lookalike paths", () => {
    // "/shopping" starts with "/shop" but is not the "/shop/" prefix.
    expect(isShopRoute("/shopping")).toBe(false);
    expect(isShopRoute("/cartoon")).toBe(false);
    expect(isShopRoute("/products")).toBe(false);
  });

  it("rejects non-shop and empty inputs", () => {
    expect(isShopRoute("/")).toBe(false);
    expect(isShopRoute("/services")).toBe(false);
    expect(isShopRoute("/admin/orders")).toBe(false);
    expect(isShopRoute(null)).toBe(false);
    expect(isShopRoute(undefined)).toBe(false);
    expect(isShopRoute("")).toBe(false);
  });
});

describe("brandForRoute", () => {
  it("returns mtr on shop routes", () => {
    expect(brandForRoute("/shop")).toBe("mtr");
    expect(brandForRoute("/product/xyz")).toBe("mtr");
    expect(brandForRoute("/checkout")).toBe("mtr");
  });

  it("returns htc everywhere else", () => {
    expect(brandForRoute("/")).toBe("htc");
    expect(brandForRoute("/services")).toBe("htc");
    expect(brandForRoute("/book-consultation")).toBe("htc");
    expect(brandForRoute(null)).toBe("htc");
  });
});
