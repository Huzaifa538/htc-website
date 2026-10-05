/**
 * PDF quotation generation for HTC (jspdf) — quotation variant of the
 * lib/invoice.ts pattern.
 *
 * generateQuotationPdf(quotation, settings) builds a professional quotation:
 * brand header + logo (/logo.png when it loads — falls back to a text
 * header), quotation number, date, "quote to" block, optional service
 * reference, line-item table, totals, notes, validity line and a footer.
 * Returns the jsPDF document — the caller decides whether to
 * save/download or print it.
 *
 * Amounts use formatPKRCompact ("Rs 1,250") because jsPDF's built-in
 * fonts cannot render non-ASCII currency glyphs.
 */
import { jsPDF } from "jspdf";
import type { Quotation, SiteSettings, WithId } from "@/lib/types";
import { QUOTATION_STATUS_LABELS } from "@/lib/types";
import { formatPKRCompact } from "@/lib/format";
import { quotationFileName, quotationNumber } from "@/lib/quotations";

export { quotationFileName, quotationNumber };

function dateLabel(q: WithId<Quotation>): string {
  try {
    return q.createdAt.toDate().toLocaleDateString("en-PK", {
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

export async function generateQuotationPdf(
  quotation: WithId<Quotation>,
  settings: Partial<SiteSettings> = {}
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const right = pageW - margin;
  const contentW = right - margin;
  let y = 52;

  const brand =
    quotation.brand === "mtr"
      ? "MTR Store — Hammer Trading Company"
      : settings.siteName?.trim() || "Hammer Trading Company";
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

  // quotation title block, right aligned
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("QUOTATION", right, y + 8, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(quotationNumber(quotation.id), right, y + 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grey);
  doc.text(`Date: ${dateLabel(quotation)}`, right, y + 41, { align: "right" });
  doc.text(
    `Status: ${QUOTATION_STATUS_LABELS[quotation.status]}`,
    right,
    y + 54,
    { align: "right" }
  );

  y += 92;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, right, y);
  y += 20;

  /* ------------------------------- quote to ------------------------------ */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text("QUOTE TO", margin, y);
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text(quotation.customerName ?? "—", margin, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  const contactLines = [
    quotation.phone && `Phone: ${quotation.phone}`,
    quotation.email && `Email: ${quotation.email}`,
  ].filter(Boolean) as string[];
  contactLines.slice(0, 3).forEach((line, i) => {
    doc.text(line, margin, y + 33 + i * 14);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text("BRAND", right - 130, y);
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text(quotation.brand === "mtr" ? "MTR Store" : "HTC Company", right - 130, y + 17);
  if (quotation.serviceName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...grey);
    doc.text("SERVICE", right - 130, y + 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const svc = doc.splitTextToSize(quotation.serviceName, 130) as string[];
    svc.slice(0, 2).forEach((line, i) => {
      doc.text(line, right - 130, y + 52 + i * 13);
    });
  }

  y += 92;

  /* ------------------------------ line items ----------------------------- */
  const cols = [
    { label: "#", x: margin, w: 30, align: "left" as const },
    { label: "Item", x: margin + 30, w: 258, align: "left" as const },
    { label: "Qty", x: margin + 288, w: 44, align: "right" as const },
    { label: "Unit price", x: margin + 332, w: 80, align: "right" as const },
    { label: "Amount", x: margin + 412, w: contentW - 412, align: "right" as const },
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

  const items = quotation.items ?? [];
  if (items.length === 0) {
    doc.setTextColor(...grey);
    doc.setFontSize(10);
    doc.text("Items to be priced by our team.", margin, y + 6);
    y += 30;
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nameLines = doc.splitTextToSize(item.name ?? "—", cols[1].w) as string[];
    const rowH = Math.max(nameLines.length, 1) * 13 + 10;

    if (y + rowH > pageH - 150) {
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
      { text: String(item.qty ?? 0), col: cols[2] },
      { text: formatPKRCompact(item.unitPrice), col: cols[3] },
      {
        text: formatPKRCompact((item.unitPrice ?? 0) * (item.qty ?? 0)),
        col: cols[4],
      },
    ];
    for (const { text, col } of cells) {
      const tx = col.align === "right" ? col.x + col.w : col.x;
      if (Array.isArray(text)) {
        text.forEach((line, li) =>
          doc.text(line, tx, y + 4 + li * 13, { align: col.align })
        );
      } else {
        doc.text(text, tx, y + 4, { align: col.align });
      }
    }
    y += rowH;
  }

  /* -------------------------------- totals ------------------------------- */
  y += 14;
  const totals: [string, string, boolean][] = [
    ["Subtotal", formatPKRCompact(quotation.subtotal), false],
    ...(quotation.discount && quotation.discount > 0
      ? ([["Discount", `-${formatPKRCompact(quotation.discount)}`, false]] as [string, string, boolean][])
      : []),
    ...(quotation.tax && quotation.tax > 0
      ? ([["Tax", formatPKRCompact(quotation.tax), false]] as [string, string, boolean][])
      : []),
    ["Total", formatPKRCompact(quotation.total), true],
  ];
  const labelX = right - 190;
  for (const [label, value, bold] of totals) {
    if (y > pageH - 130) {
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

  /* -------------------------------- notes -------------------------------- */
  if (quotation.notes?.trim()) {
    y += 8;
    if (y > pageH - 120) {
      doc.addPage();
      y = 52;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...grey);
    doc.text("NOTES", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const noteLines = doc.splitTextToSize(quotation.notes.trim(), contentW) as string[];
    noteLines.slice(0, 8).forEach((line, i) => {
      doc.text(line, margin, y + 16 + i * 14);
    });
    y += 16 + Math.min(noteLines.length, 8) * 14;
  }

  /* -------------------------------- footer ------------------------------- */
  const footerY = pageH - 64;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 16, right, footerY - 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...accent);
  doc.text("Thank you for your interest!", pageW / 2, footerY, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...grey);
  doc.text(
    `This quotation is valid for 15 days · ${quotationNumber(quotation.id)}${
      settings.phone ? ` · ${settings.phone}` : ""
    }${settings.whatsappNumber ? ` · WhatsApp ${settings.whatsappNumber}` : ""}`,
    pageW / 2,
    footerY + 14,
    { align: "center" }
  );

  return doc;
}
