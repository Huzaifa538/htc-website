/**
 * Seed script for the HTC (Hammer Trading) Firestore database.
 *
 * Usage:
 *   npm run seed
 *   # or: npx tsx scripts/seed.ts
 *
 * Requires the Firebase Admin SDK env credentials:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (keep the "\n" newlines as-is)
 *
 * A `.env.local` / `.env` file in the project root is loaded automatically
 * so you can seed straight after `cp .env.example .env.local`.
 *
 * The script is idempotent: every document uses a fixed id and is written
 * with `set(..., { merge: true })`, so re-running it just refreshes the data.
 * Field names follow lib/types.ts exactly.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
// lib/types.ts models timestamps with the client SDK Timestamp type; the Admin
// SDK Timestamp is wire-compatible but a different class, so we cast at the
// boundary (data written to Firestore is identical).
import type { Timestamp as ClientTimestamp } from "firebase/firestore";
import { COLLECTIONS } from "../lib/firebase/collections";
import productsJson from "../data/htc-import-products.json";
import mappingJson from "../data/daraz-product-categories.json";
import { buildHardwareCatalog, buildHeroSlides } from "../lib/catalog-import";
import type {
  Category,
  Product,
  Service,
  Project,
  HeroSlide,
  SiteSettings,
  AboutContent,
  Coupon,
  GalleryImage,
} from "../lib/types";

/* ------------------------------------------------------------------ */
/* Env loading                                                         */
/* ------------------------------------------------------------------ */

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env loader (dotenv is not a dependency of this project). */
function loadEnvFile(name: string): void {
  const path = join(rootDir, name);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

/** Lazily-created Admin Firestore instance (only when actually seeding). */
let _db: ReturnType<typeof getFirestore> | undefined;

function getAdminDb(): ReturnType<typeof getFirestore> {
  if (_db) return _db;
  const REQUIRED = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ] as const;
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `✖ Refusing to run: missing Firebase Admin credentials: ${missing.join(", ")}\n` +
        "  Set them in .env.local (see .env.example) or export them before running `npm run seed`.",
    );
    process.exit(1);
  }
  const adminApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        });
  _db = getFirestore(adminApp);
  return _db;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Real furniture/interior photos (Unsplash + Pexels CDNs, hotlink-safe).
 * Maps each seed name to a relevant image — no more random photos. */
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const U1600 = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80`;
const P = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
const P1600 = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;

const SEED_IMAGES: Record<string, string> = {
  // Categories
  "htc-cat-doors": P1600(8364962),
  "htc-cat-furniture": U("1555041469-a586c61ea9bc"),
  "htc-cat-interior": U("1493663284031-b7e3aefcae8e"),
  "htc-cat-wooden-doors": P(8364962),
  "htc-cat-steel-doors": P(1875388),
  // Wooden door product
  "htc-door-1": P(8364962),
  "htc-door-2": P(1875388),
  "htc-door-3": P1600(8364962),
  "htc-door-brown": P(8364962),
  "htc-door-walnut": P(1875388),
  "htc-door-teak": P(8364962),
  // Steel door product
  "htc-steel-door-1": P(1875388),
  "htc-steel-door-2": P(8364962),
  // Sofa
  "htc-sofa-1": U("1555041469-a586c61ea9bc"),
  "htc-sofa-2": U("1616486338812-3dadae4b4ace"),
  "htc-sofa-charcoal": U("1555041469-a586c61ea9bc"),
  "htc-sofa-beige": U("1616486338812-3dadae4b4ace"),
  "htc-sofa-navy": U("1586023492125-27b2c045efd7"),
  // Dining table
  "htc-dining-1": U("1519710164239-da123dc03ef4"),
  // Coffee table
  "htc-coffee-1": U("1533090481720-856c6e3c1fdc"),
  // Office chair
  "htc-chair-1": U("1580480055273-228ff5388ef8"),
  // Floor lamp
  "htc-lamp-1": U("1507473885765-e6ed057f782c"),
  // Wall mirror
  "htc-mirror-1": U("1618220179428-22790b461013"),
  // Services
  "htc-svc-consult": U("1499933374294-4584851497cc"),
  "htc-svc-kitchen": U("1519710164239-da123dc03ef4"),
  "htc-svc-office": U("1580480055273-228ff5388ef8"),
  "htc-svc-custom": U("1524758631624-e2822e304c36"),
  // Projects
  "htc-proj-dha-1": U("1538688525198-9b88f6f53126"),
  "htc-proj-dha-2": U("1567016432779-094069958ea5"),
  "htc-proj-dha-3": U("1616594039964-ae9021a400a0"),
  "htc-proj-gulberg-1": U("1499933374294-4584851497cc"),
  "htc-proj-gulberg-2": U("1524758631624-e2822e304c36"),
  "htc-proj-bahria-1": U("1616486338812-3dadae4b4ace"),
  // Hero slides
  "htc-hero-doors": P1600(8364962),
  "htc-hero-interiors": U1600("1616486338812-3dadae4b4ace"),
  "htc-hero-furniture": U1600("1555041469-a586c61ea9bc"),
  // About
  "htc-about-1": U("1524758631624-e2822e304c36"),
  "htc-about-2": U("1499933374294-4584851497cc"),
  // Site logo -> local file
  "htc-logo": "/logo.png",
};

const pic = (seed: string): string => {
  const url = SEED_IMAGES[seed];
  if (url) return url;
  // Fallback: generic furniture photo (never random).
  return U("1555041469-a586c61ea9bc");
};

const now = () => Timestamp.now() as unknown as ClientTimestamp;
const atDate = (iso: string) =>
  Timestamp.fromDate(new Date(iso)) as unknown as ClientTimestamp;

async function seedCollection<T extends { id: string }>(
  collection: string,
  docs: Array<Omit<T, "id"> & { id: string }>,
): Promise<number> {
  let n = 0;
  for (const { id, ...data } of docs) {
    await getAdminDb().collection(collection).doc(id).set(data, { merge: true });
    n += 1;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Seed data (field names per lib/types.ts)                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Hardware catalog (owner's real Daraz export).                            */
/* Categories + products are built from data/htc-import-products.json and */
/* data/daraz-product-categories.json via lib/catalog-import.ts so every   */
/* reseed uses the real 111-product hardware catalog.                      */
/* ------------------------------------------------------------------ */

const hardwareCatalog = buildHardwareCatalog(productsJson, mappingJson, now);

export const categories: Array<Omit<Category, "id"> & { id: string }> =
  hardwareCatalog.categories;

export const products: Array<Omit<Product, "id"> & { id: string }> =
  hardwareCatalog.products;

export const services: Array<Omit<Service, "id"> & { id: string }> = [
  {
    id: "interior-design-consultation",
    name: "Interior Design Consultation",
    slug: "interior-design-consultation",
    description:
      "A one-on-one session with our senior designers: space planning, material selection, " +
      "and a concept mood-board for your home or office.",
    image: pic("htc-svc-consult"),
    icon: "PencilRuler",
    priceFrom: 15000,
    order: 1,
    enabled: true,
    createdAt: now(),
  },
  {
    id: "kitchen-remodeling",
    name: "Kitchen Remodeling",
    slug: "kitchen-remodeling",
    description:
      "Complete kitchen makeovers — custom cabinets, countertops, fittings, and lighting, " +
      "designed around how you cook.",
    image: pic("htc-svc-kitchen"),
    icon: "ChefHat",
    priceFrom: 250000,
    order: 2,
    enabled: true,
    createdAt: now(),
  },
  {
    id: "office-fit-out",
    name: "Office Fit-Out",
    slug: "office-fit-out",
    description:
      "Turn-key office interiors: workstations, meeting rooms, acoustic treatment, and " +
      "branding — delivered on schedule.",
    image: pic("htc-svc-office"),
    icon: "Briefcase",
    priceFrom: 500000,
    order: 3,
    enabled: true,
    createdAt: now(),
  },
  {
    id: "custom-furniture",
    name: "Custom Furniture Build",
    slug: "custom-furniture",
    description:
      "Made-to-measure furniture built in our own workshop — beds, wardrobes, TV walls, " +
      "and more, in your choice of wood and finish.",
    image: pic("htc-svc-custom"),
    icon: "Hammer",
    priceFrom: 80000,
    order: 4,
    enabled: true,
    createdAt: now(),
  },
];

export const projects: Array<Omit<Project, "id"> & { id: string }> = [
  {
    id: "dha-lahore-residence",
    title: "DHA Lahore Residence",
    client: "Private Client",
    location: "DHA Phase 6, Lahore",
    status: "Ongoing",
    progress: 65,
    startDate: atDate("2026-06-01"),
    description:
      "Full interior fit-out of a 1-kanal residence: custom wooden doors, kitchen, " +
      "wardrobes, and living-room panelling.",
    images: [pic("htc-proj-dha-1"), pic("htc-proj-dha-2"), pic("htc-proj-dha-3")],
    videos: [],
    featured: true,
    order: 1,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "gulberg-office-complex",
    title: "Gulberg Office Complex",
    client: "Tech Firm",
    location: "Gulberg Greens, Lahore",
    status: "Completed",
    progress: 100,
    startDate: atDate("2025-11-15"),
    endDate: atDate("2026-04-30"),
    description:
      "Turn-key office interior for a 40-person team: workstations, meeting rooms, " +
      "acoustic panels, and reception branding.",
    images: [pic("htc-proj-gulberg-1"), pic("htc-proj-gulberg-2")],
    videos: [],
    featured: true,
    order: 2,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "bahria-showroom",
    title: "Bahria Town Furniture Showroom",
    client: "Retail Partner",
    location: "Bahria Town, Lahore",
    status: "Upcoming",
    progress: 0,
    startDate: atDate("2026-11-01"),
    description:
      "Design and build of a 3,000 sq ft furniture showroom with display zones, " +
      "lighting design, and custom fixtures.",
    images: [pic("htc-proj-bahria-1")],
    videos: [],
    featured: false,
    order: 3,
    createdAt: now(),
    updatedAt: now(),
  },
];

/* Hardware hero slides (real product images from the catalog). */
export const heroSlides: Array<Omit<HeroSlide, "id"> & { id: string }> =
  buildHeroSlides(now);

export const siteSettings: Omit<SiteSettings, "id"> & { id: string } = {
  id: "main",
  siteName: "HTC — Hammer Trading",
  tagline: "Quality doors, furniture & interiors — crafted in Pakistan.",
  logoUrl: pic("htc-logo"),
  whatsappNumber: "+923001234567",
  phone: "+92 300 1234567",
  email: "info@htc-hammertrading.com",
  address: "Main Boulevard, DHA Phase 6, Lahore, Pakistan",
  facebookUrl: "https://facebook.com/htchammertrading",
  instagramUrl: "https://instagram.com/htc_hammer_trading",
  tiktokUrl: "https://tiktok.com/@htchammertrading",
  youtubeUrl: "https://youtube.com/@htchammertrading",
  announcementBar: "Free delivery on orders above PKR 50,000 — nationwide!",
  freeShippingThreshold: 50000,
  updatedAt: now(),
};

export const aboutContent: Omit<AboutContent, "id"> & { id: string } = {
  id: "main",
  heading: "Craftsmanship You Can Trust Since 2010",
  body: "Hammer Trading (HTC) started as a small carpentry workshop in Lahore and has grown " +
    "into a full-service doors, furniture, and interior-design company. Every piece is built " +
    "in our own workshop by master craftsmen using seasoned timber and quality hardware. " +
    "We handle everything in-house — design, manufacturing, delivery, and installation — " +
    "so you get one accountable partner from concept to completion.",
  images: [pic("htc-about-1"), pic("htc-about-2")],
  stats: [
    { label: "Years of Experience", value: "15+" },
    { label: "Projects Completed", value: "1,200+" },
    { label: "Happy Customers", value: "8,500+" },
    { label: "Cities Served", value: "25+" },
  ],
  updatedAt: now(),
};

export const coupons: Array<Omit<Coupon, "id"> & { id: string }> = [
  {
    id: "coupon-welcome10",
    code: "WELCOME10",
    type: "percent",
    value: 10,
    minOrder: 5000,
    maxUses: 500,
    usedCount: 0,
    enabled: true,
    expiresAt: atDate("2027-12-31"),
    createdAt: now(),
  },
  {
    id: "coupon-flat500",
    code: "FLAT500",
    type: "flat",
    value: 500,
    minOrder: 10000,
    maxUses: 200,
    usedCount: 0,
    enabled: true,
    expiresAt: atDate("2027-06-30"),
    createdAt: now(),
  },
];

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

export const galleryImages: Array<Omit<GalleryImage, "id"> & { id: string }> = [
  { id: "gallery-1", title: "Modern living room setup", category: "Interiors", imageUrl: U("1616486338812-3dadae4b4ace"), order: 1, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
  { id: "gallery-2", title: "Handcrafted wooden door", category: "Doors", imageUrl: P(8364962), order: 2, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
  { id: "gallery-3", title: "Designer sofa collection", category: "Furniture", imageUrl: U("1555041469-a586c61ea9bc"), order: 3, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
  { id: "gallery-4", title: "Elegant bedroom interior", category: "Interiors", imageUrl: U("1538688525198-9b88f6f53126"), order: 4, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
  { id: "gallery-5", title: "Oakwood dining set", category: "Furniture", imageUrl: U("1519710164239-da123dc03ef4"), order: 5, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
  { id: "gallery-6", title: "Brass floor lamp corner", category: "Decor", imageUrl: U("1507473885765-e6ed057f782c"), order: 6, enabled: true, createdAt: now() as unknown as GalleryImage["createdAt"] },
];

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const results: Array<[string, number]> = [
    [COLLECTIONS.categories, await seedCollection<Category>(COLLECTIONS.categories, categories)],
    [COLLECTIONS.products, await seedCollection<Product>(COLLECTIONS.products, products)],
    [COLLECTIONS.services, await seedCollection<Service>(COLLECTIONS.services, services)],
    [COLLECTIONS.projects, await seedCollection<Project>(COLLECTIONS.projects, projects)],
    [COLLECTIONS.heroSlides, await seedCollection<HeroSlide>(COLLECTIONS.heroSlides, heroSlides)],
    [
      COLLECTIONS.siteSettings,
      await seedCollection<SiteSettings>(COLLECTIONS.siteSettings, [siteSettings]),
    ],
    [
      COLLECTIONS.aboutContent,
      await seedCollection<AboutContent>(COLLECTIONS.aboutContent, [aboutContent]),
    ],
    [COLLECTIONS.coupons, await seedCollection<Coupon>(COLLECTIONS.coupons, coupons)],
    [COLLECTIONS.galleryImages, await seedCollection<GalleryImage>(COLLECTIONS.galleryImages, galleryImages)],
  ];

  console.log("✔ Seed complete:");
  for (const [name, count] of results) console.log(`  ${name}: ${count} document(s)`);
}

// Only run when executed directly (`npm run seed`); importing this module
// (e.g. from export-seed-json.ts) must NOT trigger a seed.
const invokedDirectly =
  !!process.argv[1] &&
  (process.argv[1].endsWith("/seed.ts") || process.argv[1].endsWith("\\seed.ts"));
if (invokedDirectly) {
  main().catch((err) => {
    console.error("✖ Seed failed:", err);
    process.exit(1);
  });
}
