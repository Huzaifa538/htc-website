/**
 * Export seed data to scripts/seed-data.json (no Firebase credentials needed).
 *
 * Usage: npx tsx scripts/export-seed-json.ts
 *
 * The JSON is a reference/archive of the seed documents. To actually seed
 * Firestore, use `npm run seed` with FIREBASE_ADMIN_* service-account env
 * vars (see README). Timestamps are exported as ISO 8601 strings.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  categories,
  products,
  services,
  projects,
  heroSlides,
  siteSettings,
  aboutContent,
  coupons,
} from "./seed";
import { COLLECTIONS } from "../lib/firebase/collections";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Firestore Timestamps (admin or client SDK) → ISO string. */
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // Admin SDK Timestamp has toDate(); client SDK too.
    if (typeof v.toDate === "function") {
      try {
        return (v.toDate() as Date).toISOString();
      } catch {
        /* fall through */
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = serialize(val);
    return out;
  }
  return value;
}

const payload = {
  exportedAt: new Date().toISOString(),
  projectId: "htc-website-d19cb",
  collections: {
    [COLLECTIONS.categories]: categories,
    [COLLECTIONS.products]: products,
    [COLLECTIONS.services]: services,
    [COLLECTIONS.projects]: projects,
    [COLLECTIONS.heroSlides]: heroSlides,
    [COLLECTIONS.siteSettings]: [siteSettings],
    [COLLECTIONS.aboutContent]: [aboutContent],
    [COLLECTIONS.coupons]: coupons,
  },
};

const outPath = join(rootDir, "scripts", "seed-data.json");
writeFileSync(outPath, JSON.stringify(serialize(payload), null, 2));

const counts = Object.entries(payload.collections).map(
  ([k, v]) => `${k}: ${(v as unknown[]).length}`
);
console.log(`✔ Wrote ${outPath}\n  ${counts.join("\n  ")}`);
