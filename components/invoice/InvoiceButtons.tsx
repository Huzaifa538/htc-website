"use client";

/**
 * Print + Download-PDF invoice actions for a single order.
 *
 * "Print" opens a preview dialog containing the shared InvoicePrintView;
 * its Print button calls window.print(). "PDF" downloads the invoice via
 * lib/invoice.ts (jspdf). Used by the admin order detail page and the
 * customer order history page.
 */
import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { toast } from "sonner";

import type { Order, SiteSettings, WithId } from "@/lib/types";
import { generateInvoicePdf, invoiceFileName, invoiceNumber } from "@/lib/invoice";
import { InvoicePrintView } from "./InvoicePrintView";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InvoiceButtons({
  order,
  settings,
  size = "default",
}: {
  order: WithId<Order>;
  settings?: Partial<SiteSettings>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const pdf = await generateInvoicePdf(order, settings ?? {});
      pdf.save(invoiceFileName(order.id));
    } catch {
      toast.error("PDF generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <Printer className="mr-2 h-4 w-4" /> Print
      </Button>
      <Button variant="outline" size={size} onClick={() => void downloadPdf()} disabled={busy}>
        <FileDown className="mr-2 h-4 w-4" /> {busy ? "Working…" : "Download PDF"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Invoice {invoiceNumber(order.id)}</DialogTitle>
            <DialogDescription>
              Print this invoice or download it as a PDF.
            </DialogDescription>
          </DialogHeader>

          <InvoicePrintView order={order} settings={settings} />

          <DialogFooter className="no-print gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => void downloadPdf()} disabled={busy}>
              <FileDown className="mr-2 h-4 w-4" /> {busy ? "Working…" : "PDF"}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
