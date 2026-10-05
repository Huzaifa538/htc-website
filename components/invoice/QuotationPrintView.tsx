"use client";

/**
 * Clean print-friendly quotation, shared by the admin quotations page.
 *
 * Rendered inside the QuotationButtons print dialog.
 * QuotationPrintStyles injects the @media print CSS: everything else is
 * hidden while printing. The quotation is `position: fixed` in print so it
 * escapes the dialog's scroll container.
 */
import Image from "next/image";
import type { Quotation, SiteSettings, WithId } from "@/lib/types";
import { QUOTATION_STATUS_LABELS } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { fmtDateTime } from "@/components/admin/firebase";
import { quotationNumber } from "@/lib/quotation-pdf";

export const QUOTATION_PRINT_CSS = `
@media print {
  /* Only take over printing while the quotation dialog is open. */
  body:has(#quotation-print) * { visibility: hidden; }
  body:has(#quotation-print) #quotation-print,
  body:has(#quotation-print) #quotation-print * { visibility: visible; }
  body:has(#quotation-print) #quotation-print {
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

export function QuotationPrintStyles() {
  return <style>{QUOTATION_PRINT_CSS}</style>;
}

export function QuotationPrintView({
  quotation,
  settings,
}: {
  quotation: WithId<Quotation>;
  settings?: Partial<SiteSettings>;
}) {
  const brand =
    quotation.brand === "mtr"
      ? "MTR Store — Hammer Trading Company"
      : settings?.siteName?.trim() || "Hammer Trading Company";
  const items = quotation.items ?? [];

  return (
    <div id="quotation-print" className="bg-white text-black">
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
          <p className="text-xl font-bold uppercase tracking-wide">Quotation</p>
          <p className="mt-1 text-sm font-semibold">{quotationNumber(quotation.id)}</p>
          <p className="text-xs text-gray-600">{fmtDateTime(quotation.createdAt)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {QUOTATION_STATUS_LABELS[quotation.status]}
          </p>
        </div>
      </div>

      {/* quote to / service */}
      <div className="grid grid-cols-2 gap-6 py-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Quote to
          </p>
          <p className="mt-1 font-semibold">{quotation.customerName}</p>
          <p className="text-gray-700">{quotation.phone}</p>
          {quotation.email && <p className="text-gray-700">{quotation.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Brand
          </p>
          <p className="mt-1 font-semibold">
            {quotation.brand === "mtr" ? "MTR Store" : "HTC Company"}
          </p>
          {quotation.serviceName && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Service
              </p>
              <p className="font-semibold">{quotation.serviceName}</p>
            </>
          )}
        </div>
      </div>

      {/* items table */}
      {items.length > 0 ? (
        <table
          className="w-full text-sm"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "8px 4px" }}>#</th>
              <th style={{ textAlign: "left", padding: "8px 4px" }}>Item</th>
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
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{item.qty}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>
                  {formatPKR(item.unitPrice)}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>
                  {formatPKR((item.unitPrice ?? 0) * (item.qty ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-6 text-center text-sm text-gray-500">
          Items to be priced by our team.
        </p>
      )}

      {/* totals */}
      <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPKR(quotation.subtotal)}</span>
        </div>
        {(quotation.discount ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>−{formatPKR(quotation.discount)}</span>
          </div>
        )}
        {(quotation.tax ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatPKR(quotation.tax)}</span>
          </div>
        )}
        <div
          className="flex justify-between border-t pt-2 text-base font-bold"
          style={{ borderTop: "2px solid #000" }}
        >
          <span>Total</span>
          <span>{formatPKR(quotation.total)}</span>
        </div>
      </div>

      {quotation.notes?.trim() && (
        <div className="mt-6 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{quotation.notes}</p>
        </div>
      )}

      {/* footer */}
      <p className="mt-10 text-center text-sm font-semibold">
        Thank you for your interest!
      </p>
      <p className="mt-1 text-center text-xs text-gray-500">
        This quotation is valid for 15 days · {quotationNumber(quotation.id)} ·{" "}
        {[settings?.phone, settings?.whatsappNumber].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
