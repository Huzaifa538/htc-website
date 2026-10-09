/**
 * WhatsApp catalog button — customer taps it and lands in WhatsApp with
 * a pre-filled "catalog bhejo" message, so the owner can reply with the
 * product catalog PDF / images directly in chat.
 */
"use client";

import { MessageCircle } from "lucide-react";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp-order";
import { useLanguage } from "@/lib/i18n";

export function WhatsAppCatalogButton({ phone }: { phone?: string }) {
  const { t } = useLanguage();
  const digits = normalizeWhatsAppNumber(phone);
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(
    t.whatsappCatalog.message
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-95"
    >
      <MessageCircle size={16} />
      {t.whatsappCatalog.label}
    </a>
  );
}
