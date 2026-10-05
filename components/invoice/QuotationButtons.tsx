"use client";

/**
 * Print + Download-PDF quotation actions for a single quotation.
 *
 * "Print" opens a preview dialog containing the shared QuotationPrintView;
 * its Print button calls window.print(). "PDF" downloads the quotation via
 * lib/quotation-pdf.ts (jspdf). Used by the admin quotations page.
 */
import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { toast } from "sonner";

import type { Quotation, SiteSettings, WithId } from "@/lib/types";
import {
  generateQuotationPdf,
  quotationFileName,
  quotationNumber,
} from "@/lib/quotation-pdf";
import { QuotationPrintView } from "./QuotationPrintView";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QuotationButtons({
  quotation,
  settings,
  size = "default",
}: {
  quotation: WithId<Quotation>;
  settings?: Partial<SiteSettings>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const pdf = await generateQuotationPdf(quotation, settings ?? {});
      pdf.save(quotationFileName(quotation.id));
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
            <DialogTitle>Quotation {quotationNumber(quotation.id)}</DialogTitle>
            <DialogDescription>
              Print this quotation or download it as a PDF.
            </DialogDescription>
          </DialogHeader>

          <QuotationPrintView quotation={quotation} settings={settings} />

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
