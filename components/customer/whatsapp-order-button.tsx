/**
 * WhatsApp Order button — "WhatsApp par Order Karein".
 *
 * Premium green button used on product pages and product cards. Opens a
 * wa.me link with the product name, price and URL pre-filled, so the
 * customer just hits send. Number comes from Site Settings (admin can
 * change it any time), falling back to the store default.
 */
"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useSiteSettings } from "@/components/customer/data-hooks";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp-order";

interface Props {
  productName: string;
  priceLabel: string;
  productUrl: string;
  quantity?: number;
  /** "full" for product pages, "compact" for cards */
  size?: "full" | "compact";
  className?: string;
}

export function WhatsAppOrderButton({
  productName,
  priceLabel,
  productUrl,
  quantity,
  size = "full",
  className,
}: Props) {
  const { settings } = useSiteSettings();
  const { t } = useLanguage();
  const href = buildWhatsAppOrderUrl(settings?.whatsappNumber, {
    productName,
    priceLabel,
    productUrl,
    quantity,
  });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.whatsapp.orderLabel(productName)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#1FA855] font-bold text-white shadow-lg transition",
        "hover:bg-[#178a44] hover:shadow-xl active:scale-[0.98]",
        size === "full" ? "w-full py-3.5 text-base" : "px-4 py-2 text-sm",
        className
      )}
    >
      <MessageCircle size={size === "full" ? 19 : 15} className="shrink-0" />
      {t.whatsapp.orderOnWhatsApp}
    </a>
  );
}
