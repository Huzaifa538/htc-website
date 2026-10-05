/**
 * /shop — server wrapper with SEO metadata.
 *
 * Interactive shop (filters, search, sort) lives in ./shop-client.tsx.
 * When ?category=<id|slug> is present, the title/description name the
 * category via a server-side catalog lookup; otherwise generic shop copy.
 */
import type { Metadata } from "next";
import ShopClient from "./shop-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { absoluteUrl, canonicalUrl, SITE_SHORT_NAME } from "@/lib/seo";
import { getCategoriesSeo } from "@/lib/seo-catalog";

const BASE_TITLE = "Shop Best Door Hardware, Screws, Tools & Interior Fittings Online";
const BASE_DESCRIPTION =
  "Shop Pakistan's best door locks, handles, hinges, screws, wood screws, tower bolts, cabinet hardware, interior fittings & hand tools online 2026. Best sellers at best prices with cash on delivery & nationwide shipping from Hammer Trading Company (MTR Store).";

interface ShopSearchParams {
  category?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ShopSearchParams;
}): Promise<Metadata> {
  const param = searchParams?.category;
  if (param) {
    try {
      const categories = await getCategoriesSeo();
      const match = categories.find((c) => c.id === param || c.slug === param);
      if (match) {
        const title = `${match.name} — Shop Online in Pakistan`;
        const description =
          `Buy ${match.name.toLowerCase()} online in Pakistan — genuine quality door hardware with cash on delivery and nationwide shipping from Hammer Trading Company.`;
        return {
          title,
          description,
          keywords: [match.name, `${match.name} Pakistan`, `buy ${match.name.toLowerCase()} online`],
          alternates: {
            canonical: `${canonicalUrl("/shop")}?category=${encodeURIComponent(match.slug)}`,
          },
          openGraph: {
            title: `${title} | ${SITE_SHORT_NAME}`,
            description,
            url: `${absoluteUrl("/shop")}?category=${encodeURIComponent(match.slug)}`,
          },
        };
      }
    } catch {
      // Fall through to the generic shop metadata below.
    }
  }

  return {
    title: BASE_TITLE,
    description: BASE_DESCRIPTION,
    alternates: { canonical: canonicalUrl("/shop") },
    openGraph: {
      title: `${BASE_TITLE} | ${SITE_SHORT_NAME}`,
      description: BASE_DESCRIPTION,
      url: absoluteUrl("/shop"),
    },
  };
}

export default function ShopPage() {
  return (
    <ErrorBoundary section="Shop">
      <ShopClient />
    </ErrorBoundary>
  );
}
