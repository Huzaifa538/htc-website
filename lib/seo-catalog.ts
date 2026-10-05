/**
 * SERVER-ONLY catalog fetchers for SEO (metadata, sitemap, JSON-LD).
 *
 * Uses the Firebase Admin SDK so generateMetadata / sitemap / JSON-LD can
 * resolve products and categories without a browser. Every function fails
 * soft: when the Admin SDK isn't configured (missing env keys at build
 * time) or a query errors, it returns null / an empty list and callers
 * fall back to generic metadata — the build never crashes because of SEO.
 *
 * Never import this module from client components.
 */
import { cache } from "react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { getProductPrice } from "@/components/customer/product-utils";
import type { Category, Product, WithId } from "@/lib/types";

export interface ProductSeo {
  id: string;
  name: string;
  urduName?: string;
  slug: string;
  description: string;
  shortDescription?: string;
  images: string[];
  price: number;
  compareAt?: number;
  stock: number;
  categoryId: string;
  categoryName?: string;
  rating: number;
  reviewCount: number;
  sku: string;
}

export interface CategorySeo {
  id: string;
  name: string;
  slug: string;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function productToSeo(
  p: WithId<Product>,
  categoryName?: string
): ProductSeo {
  const priceInfo = getProductPrice(p);
  return {
    id: p.id,
    name: asString(p.name),
    urduName: asString(p.urduName) || undefined,
    slug: asString(p.slug) || p.id,
    description: asString(p.description),
    shortDescription: asString(p.shortDescription) || undefined,
    images: Array.isArray(p.images) ? p.images.filter((i) => typeof i === "string") : [],
    price: priceInfo.price,
    compareAt: priceInfo.compareAt,
    stock: priceInfo.stock,
    categoryId: asString(p.categoryId),
    categoryName,
    rating: asNumber(p.rating),
    reviewCount: asNumber(p.reviewCount),
    sku: asString(p.sku),
  };
}

async function fetchProductDoc(
  idOrSlug: string
): Promise<WithId<Product> | null> {
  if (!isAdminConfigured() || !adminDb) return null;
  try {
    const col = adminDb.collection(COLLECTIONS.products);
    const direct = await col.doc(idOrSlug).get();
    if (direct.exists) {
      return { ...(direct.data() as Product), id: direct.id };
    }
    const bySlug = await col.where("slug", "==", idOrSlug).limit(1).get();
    if (!bySlug.empty) {
      const doc = bySlug.docs[0]!;
      return { ...(doc.data() as Product), id: doc.id };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCategoryName(categoryId: string): Promise<string | undefined> {
  if (!isAdminConfigured() || !adminDb || !categoryId) return undefined;
  try {
    const snap = await adminDb.collection(COLLECTIONS.categories).doc(categoryId).get();
    if (!snap.exists) return undefined;
    const name = (snap.data() as Category | undefined)?.name;
    return typeof name === "string" && name ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Resolve one product by Firestore id or slug. Null when unavailable. */
export const getProductSeo = cache(
  async (idOrSlug: string): Promise<ProductSeo | null> => {
    if (!idOrSlug) return null;
    const doc = await fetchProductDoc(idOrSlug);
    if (!doc) return null;
    const categoryName = await fetchCategoryName(doc.categoryId);
    return productToSeo(doc, categoryName);
  }
);

/** Enabled categories (for sitemap + shop metadata). Empty list on failure. */
export const getCategoriesSeo = cache(async (): Promise<CategorySeo[]> => {
  if (!isAdminConfigured() || !adminDb) return [];
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.categories)
      .where("enabled", "==", true)
      .limit(100)
      .get();
    const list: CategorySeo[] = [];
    snap.forEach((d) => {
      const c = d.data() as Category;
      if (c.name && c.slug) {
        list.push({
          id: d.id,
          name: c.name,
          slug: c.slug,
        });
      }
    });
    return list;
  } catch {
    return [];
  }
});

/** Published products (for the sitemap). Empty list on failure. */
export const getProductsSeo = cache(async (): Promise<ProductSeo[]> => {
  if (!isAdminConfigured() || !adminDb) return [];
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.products)
      .where("published", "==", true)
      .limit(500)
      .get();
    const list: ProductSeo[] = [];
    snap.forEach((d) => {
      const p = { ...(d.data() as Product), id: d.id };
      if (p.name) list.push(productToSeo(p));
    });
    return list;
  } catch {
    return [];
  }
});
