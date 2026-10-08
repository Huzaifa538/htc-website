/**
 * LanguageToggle — EN | اردو pill for the navbar.
 * Matches the existing round icon-button style (theme toggle, etc.).
 */
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { lang, toggleLang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-10 w-[76px]" />;

  const isUrdu = lang === "ur";

  return (
    <button
      onClick={toggleLang}
      aria-label={t.header.language}
      title={t.header.language}
      className="relative flex h-10 w-[76px] items-center rounded-full p-1 text-[12px] font-extrabold ring-1 ring-black/5 transition-all hover:bg-black/[0.04] active:scale-95 dark:ring-white/10 dark:hover:bg-white/10"
    >
      {/* Sliding highlight — logical positioning so it tracks the
          active label in both LTR and RTL */}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn(
          "absolute top-1 h-8 w-[34px] rounded-full bg-[#D21F26] shadow",
          isUrdu ? "end-1" : "start-1"
        )}
      />
      <span
        className={cn(
          "relative z-10 w-[34px] text-center transition-colors",
          !isUrdu ? "text-white" : "text-foreground/50"
        )}
      >
        EN
      </span>
      <span
        className={cn(
          "relative z-10 w-[34px] text-center text-[13px] transition-colors",
          isUrdu ? "text-white" : "text-foreground/50"
        )}
      >
        اردو
      </span>
    </button>
  );
}
