/**
 * /product/[id] — server wrapper with SEO metadata + JSON-LD.
 *
 * The interactive product experience (gallery, variants, cart, reviews)
 * lives in ./product-client.tsx and still fetches its data client-side,
 * exactly as before. This shell resolves the product server-side via the
 * Admin SDK (graceful fallback when unavailable) for:
 *   - generateMetadata (title, description, OG/Twitter, canonical)
 *   - Product + BreadcrumbList JSON-LD
 */
import type { Metadata } from "next";
import ProductClient from "./product-client";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  JsonLd,
  productBreadcrumbs,
  productSchema,
} from "@/components/customer/json-ld";
import { formatPKR } from "@/lib/format";
import {
  absoluteUrl,
  canonicalUrl,
  truncateDescription,
} from "@/lib/seo";
import { getProductSeo } from "@/lib/seo-catalog";

interface ProductParams {
  id: string;
}

function productPath(slug: string): string {
  return `/product/${encodeURIComponent(slug)}`;
}

export async function generateMetadata({
  params,
}: {
  params: ProductParams;
}): Promise<Metadata> {
  const product = await getProductSeo(params.id);
  if (!product) {
    return {
      title: "Product | HTC — Hammer Trading",
      description:
        "Browse Hammer Trading Company's door hardware collection.",
      robots: { index: false, follow: true },
    };
  }

  const priceLabel = formatPKR(product.price);
  const title = `${product.name} — ${priceLabel} | Hammer Trading`;
  const description = truncateDescription(
    product.shortDescription || product.description || product.name
  );
  const image = product.images[0]
    ? absoluteUrl(product.images[0])
    : absoluteUrl("/logo.png");
  const canonical = canonicalUrl(productPath(product.slug));

  return {
    // Absolute: bypass the layout's "%s | HTC — Hammer Trading" template,
    // the required format already carries the brand suffix.
    title: { absolute: title },
    description,
    keywords: [
      product.name,
      ...(product.categoryName ? [product.categoryName] : []),
      "buy online Pakistan",
      "cash on delivery",
      "Hammer Trading Company",
    ],
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: [
        {
          url: image,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: ProductParams;
}) {
  const product = await getProductSeo(params.id);

  return (
    <>
      {product && (
        <>
          <JsonLd data={productSchema(product)} />
          <JsonLd data={productBreadcrumbs(product)} />
        </>
      )}
      <ErrorBoundary section="Product detail">
        <ProductClient id={params.id} />
      </ErrorBoundary>
    </>
  );
}
