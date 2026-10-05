/**
 * Hardware catalog import — shared by scripts/seed.ts and the temporary
 * app/api/admin/import-catalog route.
 *
 * Source data (owner's latest export — supersedes daraz-products.json):
 *   data/htc-import-products.json  {"Product Name": {sku, sellerSku, images[],
 *                                    category, price, mrp, stock}}
 *
 * Every product is assigned to the owner's exact Daraz category (the
 * "category" field, falling back to data/daraz-product-categories.json).
 * Daraz category keys become readable website labels via
 * DARAZ_CATEGORY_LABELS below.
 */
import type { Category, HeroSlide, Product } from "./types";

/** One entry of data/htc-import-products.json. */
export interface DarazProductEntry {
  sku: string;
  sellerSku: string;
  images: string[];
  category: string;
  price: number;
  mrp: number;
  stock: number;
  urduName?: string | null;
  description?: string | null;
  deliveredCount?: number | null;
}

/** Owner's Daraz category key -> readable website label. */
export const DARAZ_CATEGORY_LABELS: Record<string, string> = {
  Doorhardwarelocks: "Door Hardware & Locks",
  NailsScrewsFasteners: "Nails, Screws & Fasteners",
  FurnitureProtectorsParts: "Furniture Protectors & Parts",
  GateHardware: "Gate Hardware",
  ArtSets: "Epoxy Resin & Art Sets",
  Pliers: "Pliers",
  Clamps: "Clamps",
  ErgonomicAccessories: "Ergonomic Accessories",
  Curtains: "Curtains",
  PowerToolAccessory: "Power Tool Accessories",
  PictureHangersHooks: "Picture Hangers & Hooks",
  KidsBookcasesShelving: "Kids Bookcases & Shelving",
  BeddingAccessories: "Bedding Accessories",
  BathroomTapware: "Bathroom Tapware",
  PaintToolsAccessories: "Paint Tools & Accessories",
  GluesAdhesive: "Glues & Adhesives",
  LocksDeadbolts: "Locks & Deadbolts",
  WateringSystemsGardenHose: "Watering Systems & Garden Hoses",
  BlocksBuildingToys: "Blocks & Building Toys",
  CurtainRailsRings: "Curtain Rails & Rings",
  TowelRailsWarmers: "Towel Rails & Warmers",
  MeasuringLevelling: "Measuring & Levelling",
  BathroomFittings: "Bathroom Fittings",
  CleanersandKits: "Cleaners & Kits",
  ToiletRollHolders: "Toilet Roll Holders",
  GreasesLubricants: "Greases & Lubricants",
  DecorativeDoorStops: "Decorative Door Stops",
  WallDecor: "Wall Decor",
  CurtainsDrapes: "Curtains & Drapes",
  DrainCleaners: "Drain Cleaners",
};

/** Label used when a product has no mapping entry (not expected — all 111 map). */
export const FALLBACK_CATEGORY_LABEL = "Hardware";

/** URL slug helper shared by ids and slugs. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Category doc payload with a caller-supplied timestamp type. */
export type NewCategory<T> = Omit<Category, "id" | "createdAt"> & {
  id: string;
  createdAt: T;
};

/** Product doc payload with a caller-supplied timestamp type. */
export type NewProduct<T> = Omit<Product, "id" | "createdAt" | "updatedAt"> & {
  id: string;
  createdAt: T;
  updatedAt: T;
};

/** Hero slide payload without the timestamp (caller adds createdAt). */
export interface HeroSlideSeed {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  order: number;
  enabled: boolean;
}

/**
 * Build the website categories + products from the owner's import file.
 *
 * Product shape: simple products (no variants).
 *   sku                = sellerSku (fall back to sku)
 *   basePrice          = round(price)            (real PKR price)
 *   baseCompareAtPrice = round(mrp) only when mrp > price (drives the
 *                        storefront discount badge)
 *   baseStock          = stock (0 stays 0 — storefront shows "Out of stock")
 *   published          = true for all (even images:[] / stock 0 — customers
 *                        can see them and inquire on WhatsApp)
 *
 * @param productsJson  contents of data/htc-import-products.json
 * @param mappingJson   contents of data/daraz-product-categories.json
 *                      (fallback for the category key)
 * @param now           timestamp factory (client Timestamp in seed,
 *                      FieldValue.serverTimestamp() in the admin route)
 */
export function buildHardwareCatalog<T>(
  productsJson: Record<string, DarazProductEntry>,
  mappingJson: Record<string, string>,
  now: () => T,
): { categories: Array<NewCategory<T>>; products: Array<NewProduct<T>> } {
  const names = Object.keys(productsJson);
  const darazKeyFor = (name: string): string =>
    productsJson[name]?.category ?? mappingJson[name] ?? "";
  const labelFor = (name: string): string =>
    DARAZ_CATEGORY_LABELS[darazKeyFor(name)] ?? FALLBACK_CATEGORY_LABEL;

  // Stable category ids from labels.
  const labelToId = new Map<string, string>();
  for (const name of names) {
    const label = labelFor(name);
    if (!labelToId.has(label)) {
      labelToId.set(label, slugify(label) || "hardware");
    }
  }

  // First product image per category (used as the category card image).
  const categoryImage = new Map<string, string>();
  const categoryCount = new Map<string, number>();
  for (const name of names) {
    const label = labelFor(name);
    categoryCount.set(label, (categoryCount.get(label) ?? 0) + 1);
    const first = productsJson[name]?.images?.[0];
    if (first && !categoryImage.has(label)) categoryImage.set(label, first);
  }

  // Categories: biggest first so the shop landing shows the main ones.
  const orderedLabels = Array.from(labelToId.keys()).sort((a, b) => {
    const diff = (categoryCount.get(b) ?? 0) - (categoryCount.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  const categories: Array<NewCategory<T>> = orderedLabels.map((label, i) => ({
    id: labelToId.get(label) as string,
    name: label,
    slug: labelToId.get(label) as string,
    image: categoryImage.get(label) ?? "/logo.png",
    order: i + 1,
    enabled: true,
    createdAt: now(),
  }));

  // Products — unique ids derived from the name slug.
  const usedIds = new Set<string>();
  const products: Array<NewProduct<T>> = names.map((name) => {
    const entry = productsJson[name];
    const images = Array.isArray(entry?.images) ? entry.images : [];
    const label = labelFor(name);
    const categoryId = labelToId.get(label) as string;

    const base = `htc-hw-${slugify(name) || "item"}`.slice(0, 90);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);

    const price = Math.round(Number(entry?.price) || 0);
    const mrp = Math.round(Number(entry?.mrp) || 0);
    const sellerSku =
      typeof entry?.sellerSku === "string" && entry.sellerSku
        ? entry.sellerSku
        : typeof entry?.sku === "string"
          ? entry.sku
          : "";
    const urduName =
      typeof entry?.urduName === "string" && entry.urduName.trim()
        ? entry.urduName.trim()
        : undefined;
    const importDesc =
      typeof entry?.description === "string" && entry.description.trim()
        ? entry.description.trim()
        : undefined;

    return {
      id,
      name,
      slug: slugify(name),
      description:
        importDesc ??
        `Genuine hardware product from Hammer Trading Company (${label}). ` +
          `${name} — quality-checked before dispatch, with nationwide delivery across Pakistan.`,
      // Urdu name for the future Urdu version of the site.
      ...(urduName ? { urduName } : {}),
      categoryId,
      images,
      variantTypes: [],
      combinations: [],
      basePrice: price,
      // Compare-at price only when MRP is genuinely higher (drives the
      // storefront discount badge).
      baseCompareAtPrice: mrp > price ? mrp : undefined,
      costPrice: 0,
      // Owner directive (2026-10-03): hardcode 100 regardless of the
      // per-product stock in the import file.
      baseStock: 100,
      sku: sellerSku,
      tags: [label.toLowerCase(), "hardware", "htc"],
      featured: false,
      published: true,
      rating: 0,
      reviewCount: 0,
      soldCount: 0,
      // Historical deliveries carried over from the import file (0 when absent).
      deliveredCount: Math.max(0, Math.floor(Number(entry?.deliveredCount) || 0)),
      createdAt: now(),
      updatedAt: now(),
    };
  });

  return { categories, products };
}

/** 3 strong hardware product images for the homepage hero. */
const HERO_LOCK_IMG =
  "https://static-01.daraz.pk/p/8bced889b3c42d84bf2751ebd08a65b8.png";
const HERO_HANDLE_IMG =
  "https://static-01.daraz.pk/p/6ff378346a1fadbf9b0e350e521a0004.png";
const HERO_EPOXY_IMG =
  "https://static-01.daraz.pk/p/da5230d333f1f760948c45f4b8b8ed71.png";

/** Hardware-appropriate hero slides (timestamps added by the caller). */
export const HARDWARE_HERO_SLIDES: HeroSlideSeed[] = [
  {
    id: "hero-door-locks",
    image: HERO_LOCK_IMG,
    title: "Door Locks That Mean Business",
    subtitle: "Mortise locks, padlocks, tower bolts & latches — secure every door.",
    ctaText: "Shop Door Locks",
    ctaLink: "/shop?category=door-hardware-locks",
    order: 1,
    enabled: true,
  },
  {
    id: "hero-handles",
    image: HERO_HANDLE_IMG,
    title: "Handles & Knobs for Every Door",
    subtitle: "Cabinet handles, lever handles & pull handles in premium finishes.",
    ctaText: "Shop Handles",
    ctaLink: "/shop",
    order: 2,
    enabled: true,
  },
  {
    id: "hero-epoxy",
    image: HERO_EPOXY_IMG,
    title: "Epoxy Resin & Art Supplies",
    subtitle: "Crystal-clear epoxy resin & hardener for art, crafts and repairs.",
    ctaText: "Shop Epoxy",
    ctaLink: "/shop?category=epoxy-resin-art-sets",
    order: 3,
    enabled: true,
  },
];

/** Attach timestamps to the hero slide seeds. */
export function buildHeroSlides<T>(
  now: () => T,
): Array<Omit<HeroSlide, "id" | "createdAt"> & { id: string; createdAt: T }> {
  return HARDWARE_HERO_SLIDES.map((s) => ({ ...s, createdAt: now() }));
}
