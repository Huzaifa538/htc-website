/**
 * Tests for product pricing helpers (components/customer/product-utils.ts):
 * discount % math and display-price selection for simple vs variant products.
 */
import { describe, expect, it } from "vitest";
import {
  discountPct,
  getCombinationPrice,
  getProductPrice,
} from "@/components/customer/product-utils";
import type { Product } from "@/lib/types";

function simpleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Lock",
    slug: "test-lock",
    description: "A sturdy lock",
    categoryId: "c1",
    images: ["/img.png"],
    variantTypes: [],
    combinations: [],
    basePrice: 1000,
    baseStock: 10,
    sku: "T-1",
    tags: [],
    featured: false,
    published: true,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    ...overrides,
  } as Product;
}

describe("discountPct", () => {
  it("computes the percent off from a compare-at price", () => {
    expect(discountPct(800, 1000)).toBe(20);
  });

  it("is 0 when there is no compare-at price", () => {
    expect(discountPct(800)).toBe(0);
    expect(discountPct(800, undefined)).toBe(0);
  });

  it("is 0 when compare-at is not above the price", () => {
    expect(discountPct(1000, 1000)).toBe(0);
    expect(discountPct(1200, 1000)).toBe(0);
  });

  it("rounds to whole percent", () => {
    // (999 - 666) / 999 = 33.33…% → 33
    expect(discountPct(666, 999)).toBe(33);
  });
});

describe("getProductPrice", () => {
  it("uses the base price for simple products", () => {
    const info = getProductPrice(simpleProduct());
    expect(info.price).toBe(1000);
    expect(info.discountPct).toBe(0);
    expect(info.stock).toBe(10);
  });

  it("picks up the base compare-at discount", () => {
    const info = getProductPrice(
      simpleProduct({ basePrice: 800, baseCompareAtPrice: 1000 })
    );
    expect(info.compareAt).toBe(1000);
    expect(info.discountPct).toBe(20);
  });

  it("uses the lowest combination price for variant products", () => {
    const info = getProductPrice(
      simpleProduct({
        combinations: [
          {
            id: "c1",
            options: { Size: "S" },
            price: 900,
            stock: 5,
            sku: "T-S",
          },
          {
            id: "c2",
            options: { Size: "L" },
            price: 1200,
            compareAtPrice: 1500,
            stock: 3,
            sku: "T-L",
          },
        ],
      })
    );
    expect(info.price).toBe(900);
    // Lowest compare-at above the lowest price wins.
    expect(info.compareAt).toBe(1500);
    expect(info.stock).toBe(8);
  });

  it("ignores compare-at prices at or below the selling price", () => {
    const info = getProductPrice(
      simpleProduct({
        combinations: [
          {
            id: "c1",
            options: { Size: "S" },
            price: 900,
            compareAtPrice: 900,
            stock: 5,
            sku: "T-S",
          },
        ],
      })
    );
    expect(info.compareAt).toBeUndefined();
    expect(info.discountPct).toBe(0);
  });
});

describe("getCombinationPrice", () => {
  it("returns the concrete combination's price info", () => {
    const p = simpleProduct();
    const combo = {
      id: "c1",
      options: { Size: "L" },
      price: 1200,
      compareAtPrice: 1500,
      stock: 4,
      sku: "T-L",
    };
    const info = getCombinationPrice(p, combo);
    expect(info.price).toBe(1200);
    expect(info.discountPct).toBe(20);
    expect(info.stock).toBe(4);
  });

  it("falls back to the product price without a combination", () => {
    const info = getCombinationPrice(simpleProduct());
    expect(info.price).toBe(1000);
  });
});
