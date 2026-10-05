/**
 * /sitemap.xml — auto-generated from static routes + Firestore catalog.
 *
 * Products and categories resolve via the Admin SDK at build/request time.
 * If the Admin SDK isn't configured (or a query fails), the sitemap still
 * serves every static route so search consoles never get an empty file.
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getCategoriesSeo, getProductsSeo } from "@/lib/seo-catalog";

// Refresh the sitemap at most once an hour.
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; changeFrequency: "weekly" | "daily" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/services", changeFrequency: "weekly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/book-consultation", changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const routes: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  try {
    const [categories, products] = await Promise.all([
      getCategoriesSeo(),
      getProductsSeo(),
    ]);

    for (const c of categories) {
      routes.push({
        url: `${SITE_URL}/shop?category=${encodeURIComponent(c.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const p of products) {
      routes.push({
        url: `${SITE_URL}/product/${encodeURIComponent(p.slug || p.id)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  } catch {
    // Catalog unavailable — static routes above are still served.
  }

  return routes;
}
