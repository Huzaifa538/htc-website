/**
 * JSON-LD structured data — server component.
 * Renders <script type="application/ld+json"> blocks for rich results.
 */

import { absoluteUrl, BRAND, CURRENCY, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { CategorySeo, ProductSeo } from "@/lib/seo-catalog";

/** Serialize safely for embedding inside a <script> tag. */
function serialize(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

/** https://schema.org/Product — name, image, description, brand, offers. */
export function productSchema(p: ProductSeo): Record<string, unknown> {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    url: `${SITE_URL}/product/${p.slug}`,
    priceCurrency: CURRENCY,
    price: p.price,
    availability:
      p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images.length > 0 ? p.images.map(absoluteUrl) : [absoluteUrl("/logo.png")],
    description: p.shortDescription || p.description.slice(0, 500),
    sku: p.sku || p.id,
    brand: { "@type": "Brand", name: BRAND },
    offers,
  };
  if (p.reviewCount > 0 && p.rating > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(p.rating.toFixed(1)),
      reviewCount: p.reviewCount,
    };
  }
  return schema;
}

/** https://schema.org/BreadcrumbList — Home > Shop > Category > Product. */
export function breadcrumbSchema(
  items: { name: string; path?: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  };
}

/** Product page breadcrumbs: Home > Shop > [Category] > Product. */
export function productBreadcrumbs(p: ProductSeo): Record<string, unknown> {
  const items: { name: string; path?: string }[] = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
  ];
  if (p.categoryName) {
    items.push({ name: p.categoryName, path: `/shop?category=${encodeURIComponent(p.categoryId)}` });
  }
  items.push({ name: p.name });
  return breadcrumbSchema(items);
}

/** https://schema.org/Organization for the homepage. */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    description:
      "Hammer Trading Company (HTC) — quality door hardware, locks, handles, hinges, epoxy resin and hand tools with cash on delivery across Pakistan.",
  };
}

export type { ProductSeo, CategorySeo };
