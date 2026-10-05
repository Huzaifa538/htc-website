/**
 * Product pricing / variant helpers shared by customer pages.
 */
import { formatPKR } from "@/lib/format";
import type { Product, VariantCombination, WithId } from "@/lib/types";

export type ProductDoc = WithId<Product>;

/** Milliseconds for a Firestore Timestamp-like value. */
export function tsMillis(t: unknown): number {
  if (!t || typeof t !== "object") return 0;
  const ts = t as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === "function") {
    try {
      return ts.toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

export interface PriceInfo {
  price: number;
  compareAt?: number;
  discountPct: number;
  stock: number;
}

/** Discount % from a price / compare-at pair. */
export function discountPct(price: number, compareAt?: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/**
 * Display price for a product card: lowest combination price, or the base
 * price for simple products.
 */
export function getProductPrice(p: Product): PriceInfo {
  if (p.combinations && p.combinations.length > 0) {
    const price = Math.min(...p.combinations.map((c) => c.price));
    const compares = p.combinations
      .map((c) => c.compareAtPrice)
      .filter((v): v is number => typeof v === "number" && v > price);
    const compareAt = compares.length ? Math.min(...compares) : undefined;
    const stock = p.combinations.reduce((s, c) => s + (c.stock ?? 0), 0);
    return { price, compareAt, discountPct: discountPct(price, compareAt), stock };
  }
  return {
    price: p.basePrice,
    compareAt: p.baseCompareAtPrice,
    discountPct: discountPct(p.basePrice, p.baseCompareAtPrice),
    stock: p.baseStock,
  };
}

/** Price info for a concrete variant combination (or base when none). */
export function getCombinationPrice(
  p: Product,
  combination?: VariantCombination
): PriceInfo {
  if (!combination) return getProductPrice(p);
  return {
    price: combination.price,
    compareAt: combination.compareAtPrice,
    discountPct: discountPct(combination.price, combination.compareAtPrice),
    stock: combination.stock,
  };
}

/** Find the combination whose options exactly match the selection. */
export function findCombination(
  p: Product,
  options: Record<string, string>
): VariantCombination | undefined {
  const keys = p.variantTypes.map((t) => t.name);
  return p.combinations.find((c) =>
    keys.every((k) => (c.options[k] ?? "") === (options[k] ?? ""))
  );
}

/** First image, falling back to a placeholder. */
export function primaryImage(p: Product): string {
  return p.images?.[0] ?? "/logo.png";
}

/** "Rs 1,250" — used inside pill badges. */
export function priceLabel(p: Product): string {
  return formatPKR(getProductPrice(p).price);
}

/** Optional YouTube installation-guide URL (not in the base contract). */
export function productYoutubeUrl(p: Product): string | undefined {
  return (p as Product & { youtubeUrl?: string }).youtubeUrl ?? undefined;
}

/** Convert any YouTube URL into an embeddable URL. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}`;
    if (u.pathname.startsWith("/embed/")) return url;
    return null;
  } catch {
    return null;
  }
}
