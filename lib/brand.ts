/**
 * Brand helpers: HTC (Hammer Trading Company) is the company brand
 * (projects, services, appointments); MTR is the hardware store brand
 * (the 111 products). Storefront routes are branded "MTR Store".
 */
import type { ChatBrand } from "./types";

/** Routes that belong to the MTR storefront (exact or as a prefix). */
export const SHOP_ROUTE_PREFIXES = [
  "/shop",
  "/product",
  "/cart",
  "/checkout",
  "/wishlist",
];

/** True when the given pathname is inside the MTR storefront. */
export function isShopRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SHOP_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Brand for a customer-facing route: "mtr" on shop routes, "htc" elsewhere. */
export function brandForRoute(pathname: string | null | undefined): ChatBrand {
  return isShopRoute(pathname) ? "mtr" : "htc";
}

export const BRAND_LABELS: Record<ChatBrand, string> = {
  mtr: "MTR Store",
  htc: "HTC Support",
};
