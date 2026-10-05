/**
 * PDF invoice generation for HTC orders (jspdf).
 *
 * generateInvoicePdf(order, settings) builds a professional invoice:
 * "Hammer Trading Company" header + logo (/logo.png when it loads —
 * falls back to a text header), invoice number, date, bill-to block,
 * line-item table, totals and a footer note. Returns the jsPDF document —
 * the caller decides whether to save/download or print it.
 *
 * Amounts use formatPKRCompact ("Rs 1,250") because jsPDF's built-in
 * fonts cannot render non-ASCII currency glyphs.
 */
import { jsPDF } from "jspdf";
import type { Order, SiteSettings, WithId } from "@/lib/types";
import { formatPKRCompact } from "@/lib/format";

/** e.g. INV-9F3K2A1B — derived from the Firestore order id. */
export function invoiceNumber(orderId: string): string {
  return `INV-${orderId.slice(0, 8).toUpperCase()}`;
}

/** Suggested download filename for the invoice PDF. */
export function invoiceFileName(orderId: string): string {
  return `htc-invoice-${invoiceNumber(orderId)}.pdf`;
}

function variantLabel(variant: Record<string, string> | undefined): string {
  return Object.entries(variant ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function dateLabel(order: WithId<Order>): string {
  try {
    return order.createdAt.toDate().toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return new Date().toLocaleDateString("en-PK");
  }
}

/** Load /logo.png as a data URL; returns null when it fails. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(
  order: WithId<Order>,
  settings: Partial<SiteSettings> = {}
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const right = pageW - margin;
  const contentW = right - margin;
  let y = 52;

  const brand = settings.siteName?.trim() || "Hammer Trading Company";
  const accent: [number, number, number] = [210, 33, 38]; // HTC red
  const ink: [number, number, number] = [20, 20, 20];
  const grey: [number, number, number] = [110, 110, 110];

  /* ------------------------------- header ------------------------------- */
  const logo = await loadLogoDataUrl();
  let textX = margin;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y - 10, 52, 52);
      textX = margin + 64;
    } catch {
      /* image unreadable — text header only */
    }
  }
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(brand, textX, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  const subLines = [
    settings.tagline,
    settings.address,
    [settings.phone, settings.email].filter(Boolean).join(" · "),
  ].filter((s) => s && s.trim());
  subLines.slice(0, 3).forEach((line, i) => {
    doc.text(line as string, textX, y + 28 + i * 13);
  });

  // invoice title block, right aligned
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("INVOICE", right, y + 8, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(invoiceNumber(order.id), right, y + 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grey);
  doc.text(`Date: ${dateLabel(order)}`, right, y + 41, { align: "right" });
  doc.text(`Order: #${order.id.slice(0, 8).toUpperCase()}`, right, y + 54, {
    align: "right",
  });

  y += 92;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, right, y);
  y += 20;

  /* ------------------------------- bill to ------------------------------ */
  const a = order.address;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text("BILL TO", margin, y);
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text(a?.name ?? "—", margin, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  const addrLines = [a?.address, a?.city, a?.phone && `Phone: ${a.phone}`].filter(
    Boolean
  ) as string[];
  addrLines.slice(0, 3).forEach((line, i) => {
    doc.text(line, margin, y + 33 + i * 14);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text("PAYMENT", right - 130, y);
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text(order.paymentMethod ?? "—", right - 130, y + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text("STATUS", right - 130, y + 38);
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text(order.status ?? "—", right - 130, y + 53);

  y += 92;

  /* ------------------------------ line items ----------------------------- */
  const cols = [
    { label: "#", x: margin, w: 26, align: "left" as const },
    { label: "Item", x: margin + 26, w: 168, align: "left" as const },
    { label: "Variant", x: margin + 194, w: 118, align: "left" as const },
    { label: "Qty", x: margin + 312, w: 40, align: "right" as const },
    { label: "Unit price", x: margin + 352, w: 74, align: "right" as const },
    { label: "Amount", x: margin + 426, w: contentW - 426, align: "right" as const },
  ];

  const drawTableHead = (yy: number) => {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yy - 12, contentW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    for (const c of cols) {
      const tx = c.align === "right" ? c.x + c.w : c.x;
      doc.text(c.label, tx, yy + 3, { align: c.align });
    }
    return yy + 14;
  };

  y = drawTableHead(y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);

  const items = order.items ?? [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nameLines = doc.splitTextToSize(item.name ?? "—", cols[1].w) as string[];
    const variantLines = doc.splitTextToSize(
      variantLabel(item.variant) || "—",
      cols[2].w
    ) as string[];
    const rowH = Math.max(nameLines.length, variantLines.length, 1) * 13 + 10;

    if (y + rowH > pageH - 130) {
      doc.addPage();
      y = 52;
      y = drawTableHead(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...ink);
    }

    doc.setDrawColor(235, 235, 235);
    doc.line(margin, y + rowH - 6, right, y + rowH - 6);

    const cells: { text: string | string[]; col: (typeof cols)[number] }[] = [
      { text: String(i + 1), col: cols[0] },
      { text: nameLines, col: cols[1] },
      { text: variantLines, col: cols[2] },
      { text: String(item.qty ?? 0), col: cols[3] },
      { text: formatPKRCompact(item.price), col: cols[4] },
      {
        text: formatPKRCompact((item.price ?? 0) * (item.qty ?? 0)),
        col: cols[5],
      },
    ];
    for (const { text, col } of cells) {
      const tx = col.align === "right" ? col.x + col.w : col.x;
      if (Array.isArray(text)) {
        text.forEach((line, li) => doc.text(line, tx, y + 4 + li * 13, { align: col.align }));
      } else {
        doc.text(text, tx, y + 4, { align: col.align });
      }
    }
    y += rowH;
  }

  /* -------------------------------- totals ------------------------------- */
  y += 14;
  const totals: [string, string, boolean][] = [
    ["Subtotal", formatPKRCompact(order.subtotal), false],
    ...(order.discount && order.discount > 0
      ? ([["Discount", `-${formatPKRCompact(order.discount)}`, false]] as [string, string, boolean][])
      : []),
    ["Shipping", order.shipping === 0 ? "FREE" : formatPKRCompact(order.shipping), false],
    ...(order.tax && order.tax > 0
      ? ([["Tax", formatPKRCompact(order.tax), false]] as [string, string, boolean][])
      : []),
    ["Grand total", formatPKRCompact(order.total), true],
  ];
  const labelX = right - 190;
  for (const [label, value, bold] of totals) {
    if (y > pageH - 90) {
      doc.addPage();
      y = 52;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? ink : grey));
    doc.text(label, labelX, y);
    doc.setTextColor(...(bold ? accent : ink));
    doc.text(value, right, y, { align: "right" });
    y += bold ? 20 : 16;
  }

  /* -------------------------------- footer ------------------------------- */
  const footerY = pageH - 64;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 16, right, footerY - 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...accent);
  doc.text("Thank you for shopping with HTC!", pageW / 2, footerY, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...grey);
  doc.text(
    `${brand}${settings.phone ? ` · ${settings.phone}` : ""}${
      settings.whatsappNumber ? ` · WhatsApp ${settings.whatsappNumber}` : ""
    }`,
    pageW / 2,
    footerY + 14,
    { align: "center" }
  );

  return doc;
}
