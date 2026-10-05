/**
 * Quotation business logic (pure — no Firestore, no UI).
 *
 * Kept side-effect-free so it can be unit-tested directly
 * (see scripts/test-quotations.ts) and reused by the admin page,
 * the service-detail quote form, and the convert-to-order API route.
 */
import type { NewDoc, Order, Quotation, QuotationItem } from "@/lib/types";

const money = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;

/** e.g. QT-9F3K2A1B — derived from the Firestore quotation id. */
export function quotationNumber(quotationId: string): string {
  return `QT-${quotationId.slice(0, 8).toUpperCase()}`;
}

/** Suggested download filename for the quotation PDF. */
export function quotationFileName(quotationId: string): string {
  return `htc-quotation-${quotationNumber(quotationId)}.pdf`;
}

/** Line amount for one item. */
export function lineTotal(item: QuotationItem): number {
  return money(item.qty) * money(item.unitPrice);
}

export interface QuotationTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Compute totals: subtotal = Σ qty×unitPrice; total = subtotal − discount + tax.
 * Negative results are clamped to 0 (a discount can never pay the customer).
 */
export function computeTotals(
  items: QuotationItem[],
  discount: number,
  tax: number
): QuotationTotals {
  const subtotal = Math.round(
    (items ?? []).reduce((sum, i) => sum + lineTotal(i), 0)
  );
  const disc = Math.round(money(discount));
  const tx = Math.round(money(tax));
  const total = Math.max(0, subtotal - disc + tx);
  return { subtotal, discount: disc, tax: tx, total };
}

/**
 * Build a real Order document from an accepted quotation.
 *
 * Field mapping:
 * - userId: the quotation's userId when the customer was signed in,
 *   otherwise "walk-in" (no Firestore uid to attach).
 * - items: quotation lines become OrderItems (no variant, no image).
 * - shipping: 0 (quotations don't carry shipping; courier adds it later).
 * - paymentMethod "COD", status "Pending" — staff adjust from the orders page.
 * - address: built from the quotation's customer contact details.
 *
 * The caller sets createdAt/updatedAt (client: serverTimestamp();
 * API route: FieldValue.serverTimestamp()).
 */
export function buildOrderFromQuotation(
  quotation: Quotation
): NewDoc<Order> {
  const totals = computeTotals(
    quotation.items,
    quotation.discount,
    quotation.tax ?? 0
  );
  return {
    userId: quotation.userId ?? "walk-in",
    brand: quotation.brand,
    items: (quotation.items ?? []).map((i) => ({
      productId: "",
      name: i.name,
      variant: {},
      price: Math.round(money(i.unitPrice)),
      qty: Math.max(1, Math.round(money(i.qty)) || 1),
      image: "",
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: 0,
    tax: totals.tax,
    total: totals.total,
    paymentMethod: "COD",
    status: "Pending",
    address: {
      name: quotation.customerName,
      phone: quotation.phone,
      address: "",
      city: "",
    },
    notes: `Converted from quotation ${quotationNumber(quotation.id)}${
      quotation.notes?.trim() ? ` — ${quotation.notes.trim()}` : ""
    }`,
  };
}

/**
 * Payload for a customer "Request quote" from a service detail page.
 * Status "sent", brand "htc", no line items yet (admin prices it).
 */
export function buildServiceQuoteRequest(input: {
  serviceId: string;
  serviceName: string;
  customerName: string;
  phone: string;
  email?: string;
  notes?: string;
  userId?: string;
}): NewDoc<Quotation> {
  return {
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    status: "sent",
    brand: "htc",
    notes: input.notes?.trim() || undefined,
    serviceId: input.serviceId,
    serviceName: input.serviceName,
  };
}
