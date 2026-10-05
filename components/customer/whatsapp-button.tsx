/**
 * Floating WhatsApp button (number from NEXT_PUBLIC_WHATSAPP_NUMBER).
 */
"use client";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useSiteSettings } from "@/components/customer/data-hooks";

export function WhatsAppButton() {
  const { settings } = useSiteSettings();
  const envNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const raw = envNumber || settings?.whatsappNumber || "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  return (
    <motion.a
      href={`https://wa.me/${digits}?text=${encodeURIComponent("Assalam-o-Alaikum! I have a question about HTC products.")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl"
    >
      <MessageCircle size={24} />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-60" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-[#25D366] ring-2 ring-white" />
      </span>
    </motion.a>
  );
}
