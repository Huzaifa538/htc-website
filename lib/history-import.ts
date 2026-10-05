/**
 * Historical orders import — one-shot, data-layer only.
 *
 * Maps the owner's delivered-orders export (data/htc-delivered-orders.json,
 * 405 entries) into Order-shaped objects suitable for the `orders`
 * collection. Privacy: the export contains only customerName + city — those
 * are the ONLY customer fields written; phone/address are left empty.
 *
 * Product matching: each entry's sellerSku is matched against
 * data/htc-import-products.json (sellerSku, falling back to sku) and the
 * imported catalog's product id is recomputed with the same
 * `htc-hw-<name-slug>` scheme buildHardwareCatalog uses (imported from
 * ./catalog-import so the two stay in lockstep).
 */
import type { Order } from "@/lib/types";
import { slugify } from "@/lib/catalog-import";
import productsJsonRaw from "@/data/htc-import-products.json";

const productsJson = productsJsonRaw as Record<
  string,
  { sellerSku?: string; sku?: string; images?: string[] }
>;

/* ------------------------------------------------------------------ */
/* Raw JSON shape                                                       */
/* ------------------------------------------------------------------ */

export interface HistoricalOrderJson {
  orderNumber: string;
  product: string;
  sellerSku: string;
  paidPrice: number;
  unitPrice: number;
  created: string; // e.g. "30 Sep 2026 16:47" (Asia/Karachi local)
  delivered: string | null;
  status: string;
  customerName: string;
  city: string;
}

/** Order-shaped, but with plain Date timestamps (the admin route converts
 *  them to Firestore Timestamps before writing). */
export type HistoryOrderData = Omit<Order, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

export interface HistoryImportStats {
  total: number;
  imported: number;
  skipped: number;
}

/* ------------------------------------------------------------------ */
/* Date parsing: "30 Sep 2026 16:47" -> Date (UTC)                      */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse "30 Sep 2026 16:47" into a Date stored as UTC. The export times are
 * Karachi local; per the import spec we keep them simple — store as UTC
 * without an Asia/Karachi offset shift.
 */
export function parseHistoryDate(raw: string): Date | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(
    raw.trim()
  );
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (month === undefined) return null;
  if (day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return new Date(Date.UTC(year, month, day, hour, minute));
}

/* ------------------------------------------------------------------ */
/* Product lookup: sellerSku -> { id, image }                           */
/* ------------------------------------------------------------------ */

interface ProductRef {
  id: string;
  image: string;
}

/**
 * Recompute the catalog product ids with the same naming scheme as
 * buildHardwareCatalog (`htc-hw-<slugify(name)>`, deduped with -2, -3, …),
 * iterating the import JSON in insertion order, and index them by sellerSku
 * (falling back to sku, same rule as the catalog import).
 */
export function buildProductLookup(): Map<string, ProductRef> {
  const lookup = new Map<string, ProductRef>();
  const usedIds = new Set<string>();
  const names = Object.keys(productsJson);
  for (const name of names) {
    const entry = productsJson[name] as {
      sellerSku?: string;
      sku?: string;
      images?: string[];
    };
    const base = `htc-hw-${slugify(name) || "item"}`.slice(0, 90);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);

    const sellerSku =
      typeof entry?.sellerSku === "string" && entry.sellerSku
        ? entry.sellerSku
        : typeof entry?.sku === "string"
          ? entry.sku
          : "";
    const ref: ProductRef = {
      id,
      image: Array.isArray(entry?.images) && entry.images[0] ? entry.images[0] : "",
    };
    if (sellerSku && !lookup.has(sellerSku)) lookup.set(sellerSku, ref);
    if (entry?.sku && typeof entry.sku === "string" && !lookup.has(entry.sku)) {
      lookup.set(entry.sku, ref);
    }
  }
  return lookup;
}

/* ------------------------------------------------------------------ */
/* Builder                                                              */
/* ------------------------------------------------------------------ */

/**
 * Map raw history entries to Order-shaped objects.
 *
 * Rules:
 * - doc id: `hist-<orderNumber>`; when an orderNumber repeats (the export
 *   has 75 duplicate order numbers), append `-2`, `-3`, … so ids stay unique.
 * - userId: "imported-history" for all.
 * - items: single item, qty 1, price = round(paidPrice); productId matched by
 *   sellerSku ("" when no catalog product matches).
 * - subtotal/total = round(paidPrice); discount/shipping/tax = 0.
 * - paymentMethod "COD", status "Delivered", brand "mtr", imported true,
 *   source "history".
 * - address: name + city only (phone/address empty by privacy rule).
 * - createdAt/updatedAt: parsed from `created`; entries that fail parsing
 *   (or lack an orderNumber) are skipped and counted.
 */
export function buildHistoricalOrders(json: HistoricalOrderJson[]): {
  orders: HistoryOrderData[];
  stats: HistoryImportStats;
} {
  const lookup = buildProductLookup();
  const orders: HistoryOrderData[] = [];
  const seenIds = new Set<string>();
  let skipped = 0;

  for (const entry of json) {
    const orderNumber =
      typeof entry?.orderNumber === "string" ? entry.orderNumber.trim() : "";
    const created = parseHistoryDate(entry?.created ?? "");
    if (!orderNumber || !created) {
      skipped += 1;
      continue;
    }

    let id = `hist-${orderNumber}`;
    if (seenIds.has(id)) {
      let n = 2;
      while (seenIds.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seenIds.add(id);

    const matched = lookup.get(entry?.sellerSku ?? "");
    const productName =
      typeof entry?.product === "string" ? entry.product : "";
    const price = Math.round(Number(entry?.paidPrice) || 0);
    const customerName =
      typeof entry?.customerName === "string" ? entry.customerName : "";
    const city = typeof entry?.city === "string" ? entry.city : "";

    orders.push({
      id,
      userId: "imported-history",
      brand: "mtr",
      items: [
        {
          productId: matched?.id ?? "",
          name: productName,
          variant: {},
          price,
          qty: 1,
          image: matched?.image ?? "",
        },
      ],
      subtotal: price,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: price,
      paymentMethod: "COD",
      status: "Delivered",
      address: {
        name: customerName,
        phone: "",
        address: "",
        city,
      },
      imported: true,
      source: "history",
      createdAt: created,
      updatedAt: created,
    });
  }

  return {
    orders,
    stats: { total: json.length, imported: orders.length, skipped },
  };
}
