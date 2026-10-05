"use client";

/**
 * Clean print-friendly invoice for an order, shared by the admin order
 * detail page and the customer order history page.
 *
 * Rendered inside the InvoiceButtons print dialog.
 * InvoicePrintStyles injects the @media print CSS: everything else is
 * hidden while printing. The invoice is `position: fixed` in print so it
 * escapes the dialog's scroll container.
 */
import Image from "next/image";
import type { Order, SiteSettings, WithId } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { fmtDateTime } from "@/components/admin/firebase";
import { invoiceNumber } from "@/lib/invoice";

export const INVOICE_PRINT_CSS = `
@media print {
  /* Only take over printing while the invoice dialog is open. */
  body:has(#invoice-print) * { visibility: hidden; }
  body:has(#invoice-print) #invoice-print,
  body:has(#invoice-print) #invoice-print * { visibility: visible; }
  body:has(#invoice-print) #invoice-print {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 24px !important;
    margin: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
  }
  .no-print { display: none !important; }
}
`;

export function InvoicePrintStyles() {
  return <style>{INVOICE_PRINT_CSS}</style>;
}

function variantLabel(variant: Record<string, string> | undefined): string {
  return Object.entries(variant ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function InvoicePrintView({
  order,
  settings,
}: {
  order: WithId<Order>;
  settings?: Partial<SiteSettings>;
}) {
  const brand = settings?.siteName?.trim() || "Hammer Trading Company";
  const a = order.address;
  const items = order.items ?? [];

  return (
    <div id="invoice-print" className="bg-white text-black">
      {/* header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden">
            <Image
              src={settings?.logoUrl || "/logo.png"}
              alt="HTC logo"
              fill
              className="object-contain"
              sizes="56px"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{brand}</h1>
            {settings?.tagline && (
              <p className="text-xs text-gray-600">{settings.tagline}</p>
            )}
            <p className="text-xs text-gray-600">
              {[settings?.address, settings?.phone, settings?.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-wide">Invoice</p>
          <p className="mt-1 text-sm font-semibold">{invoiceNumber(order.id)}</p>
          <p className="text-xs text-gray-600">{fmtDateTime(order.createdAt)}</p>
        </div>
      </div>

      {/* bill to / payment */}
      <div className="grid grid-cols-2 gap-6 py-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Bill to
          </p>
          <p className="mt-1 font-semibold">{a?.name ?? "—"}</p>
          <p className="text-gray-700">{a?.phone}</p>
          <p className="text-gray-700">{a?.address}</p>
          <p className="text-gray-700">{a?.city}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Payment
          </p>
          <p className="mt-1 font-semibold">{order.paymentMethod}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">
            Status
          </p>
          <p className="font-semibold">{order.status}</p>
        </div>
      </div>

      {/* items table */}
      <table
        className="w-full text-sm"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "8px 4px" }}>#</th>
            <th style={{ textAlign: "left", padding: "8px 4px" }}>Item</th>
            <th style={{ textAlign: "left", padding: "8px 4px" }}>Variant</th>
            <th style={{ textAlign: "right", padding: "8px 4px" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "8px 4px" }}>Unit price</th>
            <th style={{ textAlign: "right", padding: "8px 4px" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 4px" }}>{i + 1}</td>
              <td style={{ padding: "8px 4px", fontWeight: 600 }}>{item.name}</td>
              <td style={{ padding: "8px 4px" }}>{variantLabel(item.variant) || "—"}</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>{item.qty}</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>
                {formatPKR(item.price)}
              </td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>
                {formatPKR((item.price ?? 0) * (item.qty ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPKR(order.subtotal)}</span>
        </div>
        {(order.discount ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Discount{order.coupon ? ` (${order.coupon})` : ""}</span>
            <span>−{formatPKR(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{order.shipping === 0 ? "FREE" : formatPKR(order.shipping)}</span>
        </div>
        {(order.tax ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatPKR(order.tax)}</span>
          </div>
        )}
        <div
          className="flex justify-between border-t pt-2 text-base font-bold"
          style={{ borderTop: "2px solid #000" }}
        >
          <span>Total</span>
          <span>{formatPKR(order.total)}</span>
        </div>
      </div>

      {/* footer */}
      <p className="mt-10 text-center text-sm font-semibold">
        Thank you for shopping with HTC!
      </p>
      <p className="mt-1 text-center text-xs text-gray-500">
        {invoiceNumber(order.id)} ·{" "}
        {[settings?.phone, settings?.whatsappNumber]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}
