/**
 * WhatsApp ordering helpers (client-safe).
 *
 * The store's WhatsApp number comes from Site Settings (admin/settings),
 * with a hard fallback to the number already used across the storefront.
 * Admins change it in one place — every order button follows.
 */

/** Fallback number used until the admin sets one in Site Settings. */
export const WHATSAPP_FALLBACK_NUMBER = "923212476150";

/** Strip everything but digits so "+92 321 ..." and "0321..." both work. */
export function normalizeWhatsAppNumber(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits || WHATSAPP_FALLBACK_NUMBER;
}

export interface WhatsAppOrderDetails {
  productName: string;
  /** Already-formatted price string, e.g. "Rs 1,250" */
  priceLabel: string;
  /** Full product URL, e.g. https://htc-website-two.vercel.app/product/abc */
  productUrl: string;
  quantity?: number;
}

/**
 * Build a wa.me link with a pre-filled order message in Roman Urdu:
 * "Assalam-o-Alaikum! Mujhe ye product order karna hai: ..."
 */
export function buildWhatsAppOrderUrl(
  rawNumber: string | undefined | null,
  details: WhatsAppOrderDetails
): string {
  const digits = normalizeWhatsAppNumber(rawNumber);
  const qty = details.quantity && details.quantity > 1 ? ` (Qty: ${details.quantity})` : "";
  const message =
    `Assalam-o-Alaikum! Mujhe ye product order karna hai:\n\n` +
    `📦 ${details.productName}${qty}\n` +
    `💰 Price: ${details.priceLabel}\n` +
    `🔗 ${details.productUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Simple inquiry link (for contact-for-price items). */
export function buildWhatsAppInquiryUrl(
  rawNumber: string | undefined | null,
  productName: string
): string {
  const digits = normalizeWhatsAppNumber(rawNumber);
  return `https://wa.me/${digits}?text=${encodeURIComponent(
    `Assalam-o-Alaikum! I want to inquire about ${productName}`
  )}`;
}
