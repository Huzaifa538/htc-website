/**
 * Currency helpers for HTC (Hammer Trading).
 *
 * CURRENCY is the single source of truth for the store currency (Pakistani
 * Rupee). All customer pages, admin dashboards and receipts must use
 * formatPKR() so prices render consistently across the site.
 */

export const CURRENCY = "PKR" as const;

/** ISO currency code for the store — currently always PKR. */
export const CURRENCY_ISO = "PKR" as const;

/**
 * Format a numeric amount as Pakistani Rupees.
 *
 * @param value - amount in PKR (can be fractional; defaults to 0 decimals)
 * @param opts  - Intl overrides, e.g. { maximumFractionDigits: 2 }
 */
export function formatPKR(
  value: number | null | undefined,
  opts?: Intl.NumberFormatOptions
): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: CURRENCY_ISO,
      maximumFractionDigits: 0,
      ...opts,
    }).format(amount);
  } catch {
    // Fallback when ICU data for en-PK is unavailable.
    return `Rs ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

/** "Rs 1,250" shorthand without currency symbol handling differences. */
export function formatPKRCompact(value: number | null | undefined): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `Rs ${Math.round(amount).toLocaleString("en-US")}`;
}

/**
 * Display price for the storefront. A price of 0 (or missing) means
 * "Contact for price" — used for catalog items whose price isn't set yet.
 */
export function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Contact for price";
  }
  return formatPKR(value);
}

/** True when the price is unset (0) — customer should inquire instead of buying. */
export function isPriceUnset(value: number | null | undefined): boolean {
  return typeof value !== "number" || !Number.isFinite(value) || value <= 0;
}
