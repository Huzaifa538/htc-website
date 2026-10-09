/**
 * HTC helper bot — rule-based FAQ answers.
 *
 * Delivery time, returns, payment, contact, timings waghera ke
 * aam sawalon ka jawab deta hai (Urdu + English). Jawab na mile
 * to WhatsApp par bhej deta hai.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/en";

interface Msg {
  from: "bot" | "user";
  text: string;
  isFallback?: boolean;
}

const WHATSAPP = "https://wa.me/923212476150";

function findAnswer(q: string, t: Dictionary): string | null {
  const s = q.toLowerCase();

  const has = (...words: string[]) => words.some((w) => s.includes(w));

  if (has("deliver", "shipping", "ship", "डिलीवरी", "پہنچ", "کب آئے", "کتنے دن", "پہنچے")) {
    return t.chatBot.delivery;
  }
  if (has("return", "refund", "exchange", "واپس", "تبدیل")) {
    return t.chatBot.returns;
  }
  if (has("payment", "pay", "cod", "cash", "jazzcash", "easypaisa", "card", "ادائیگی", "پیسے")) {
    return t.chatBot.payment;
  }
  if (has("timing", "time", "open", "close", "hour", "ٹائم", "کھلا", "بند", "اوقات")) {
    return t.chatBot.timings;
  }
  if (has("contact", "phone", "number", "whatsapp", "رابطہ", "فون", "نمبر")) {
    return t.chatBot.contact;
  }
  if (has("location", "address", "shop", "store", "where", "پتہ", "دکان", "کہاں")) {
    return t.chatBot.location;
  }
  if (has("price", "cost", "rate", "قیمت", "دام", "پیسے")) {
    return t.chatBot.price;
  }
  if (has("salam", "assalam", "hello", "hi", "hey", "aoa", "السلام")) {
    return t.chatBot.greeting;
  }
  if (has("thank", "shukriya", "شکریہ")) {
    return t.chatBot.thanks;
  }
  return null;
}

export function ChatBot() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const answer = findAnswer(clean, t);
    setMsgs((m) => [
      ...m,
      { from: "user", text: clean },
      {
        from: "bot",
        text: answer ?? t.chatBot.fallback,
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
        aria-label="HTC helper"
        className="fixed bottom-40 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-xl transition hover:scale-105"
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
            <div className="bg-[#D21F26] px-4 py-3 text-white">
              <p className="font-bold">{t.chatBot.title}</p>
              <p className="text-xs opacity-80">{t.chatBot.subtitle}</p>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t.chatBot.hint}</p>
                  {t.chatBot.quick.map((q: string) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="block w-full rounded-full border px-3 py-1.5 text-left text-xs transition hover:border-[#D21F26] hover:text-[#D21F26]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.from === "bot"
                      ? "bg-stone-100 dark:bg-stone-800"
                      : "ml-auto bg-[#D21F26] text-white"
                  }`}
                >
                  {m.text}
                  {m.from === "bot" && m.isFallback && (
                    <a
                      href={WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-center rounded-full bg-[#1FA855] px-3 py-1.5 text-xs font-bold text-white"
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
                className="flex-1 rounded-full border px-3 py-2 text-sm outline-none focus:border-[#D21F26]"
              />
              <button
                onClick={() => send(input)}
                aria-label={t.chatBot.send}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D21F26] text-white"
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
