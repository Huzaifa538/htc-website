/**
 * Brand bots — do alag FAQ helpers.
 *
 * HTC Bot (purple): services, interior design, consultation, projects.
 * MTR Bot (blue): products, shopping, orders, delivery.
 *
 * Kaunsa bot dikhega ye page ke brand par hai (shop routes → MTR,
 * baqi → HTC). Admin online ho to bot khud band (auto-switch) aur
 * "admin se baat karein" ka rasta dikhta hai.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { brandForRoute } from "@/lib/brand";
import { useBotMode } from "@/lib/bot-mode";
import { findBotAnswer, botFallback } from "@/lib/bot-answers";
import type { ChatBrand } from "@/lib/types";

interface Msg {
  from: "bot" | "user";
  text: string;
  isFallback?: boolean;
}

const WHATSAPP = "https://wa.me/923212476150";

const BRAND_COLOR: Record<ChatBrand, string> = {
  htc: "#7C3AED", // purple
  mtr: "#2563EB", // blue
};

export function ChatBot() {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const brand = brandForRoute(pathname);
  const { botActiveFor, loaded } = useBotMode();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openAdminChat = useChatUiStore((s) => s.openChat);

  const botActive = botActiveFor(brand);
  const color = BRAND_COLOR[brand];
  const dict = brand === "htc" ? t.htcBot : t.mtrBot;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  // Admin se baat — bot band karo, messaging chat kholo
  function talkToAdmin() {
    setOpen(false);
    openAdminChat();
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const preferUrdu = lang === "ur" || /[\u0600-\u06FF]/.test(clean);
    const answer = findBotAnswer(clean, brand);
    setMsgs((m) => [
      ...m,
      { from: "user", text: clean },
      {
        from: "bot",
        text: answer ?? botFallback(brand, preferUrdu),
        isFallback: !answer,
      },
    ]);
    setInput("");
  }

  return (
    <>
      {/* floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={dict.title}
        style={{ backgroundColor: color }}
        className="fixed bottom-40 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-56 right-5 z-50 flex h-[420px] w-[320px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-stone-900"
          >
            <div className="px-4 py-3 text-white" style={{ backgroundColor: color }}>
              <p className="font-bold">{dict.title}</p>
              <p className="text-xs opacity-80">{dict.subtitle}</p>
            </div>

            <button
              onClick={talkToAdmin}
              className="mx-3 mt-2 flex items-center justify-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-400 dark:border-stone-700 dark:text-stone-300"
            >
              <UserCheck size={13} /> {t.chatBot.talkToAdmin}
            </button>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {!botActive && loaded && (
                <p
                  className="rounded-xl px-3 py-2 text-center text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {t.chatBot.adminOnlineNote}
                </p>
              )}
              {msgs.length === 0 && botActive && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t.chatBot.hint}</p>
                  {dict.quick.map((q: string) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="block w-full rounded-full border px-3 py-1.5 text-left text-xs transition hover:border-stone-400"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.from === "bot"
                      ? "bg-stone-100 dark:bg-stone-800"
                      : "ml-auto text-white",
                    m.from !== "bot" && "bg-[#D21F26]"
                  )}
                >
                  {m.text}
                  {m.from === "bot" && m.isFallback && (
                    <a
                      href={WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block rounded-full bg-[#1FA855] px-3 py-1.5 text-center text-xs font-bold text-white"
                    >
                      {t.chatBot.whatsappUs}
                    </a>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder={t.chatBot.placeholder}
                className="flex-1 rounded-full border px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
              <button
                onClick={() => send(input)}
                aria-label={t.chatBot.send}
                style={{ backgroundColor: color }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
