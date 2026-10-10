/**
 * Global search with live suggestions dropdown (products by name).
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Mic, MicOff } from "lucide-react";
import { formatPKR } from "@/lib/format";
import { getProductPrice, primaryImage } from "@/components/customer/product-utils";
import { useProducts } from "@/components/customer/data-hooks";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { products } = useProducts();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  // Voice search — Web Speech API (Chrome/Edge). Mic dabao, bolo, product dhoondo.
  function toggleVoice() {
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          onresult: ((e: { results?: Array<Array<{ transcript?: string }>> }) => void) | null;
          onend: (() => void) | null;
          onerror: ((ev: { error?: string }) => void) | null;
          start: () => void;
          stop: () => void;
        })
      | undefined;
    if (!SR) {
      // Browser support nahi karta — user type karke dhoonde
      toast.error(
        lang === "ur"
          ? "آپ کا براؤزر وائس سرچ سپورٹ نہیں کرتا"
          : "Your browser doesn't support voice search"
      );
      return;
    }
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = lang === "ur" ? "ur-PK" : "en-PK"; // Urdu + English dono sunta hai
    recog.interimResults = true; // bolte waqt live dikhe
    recog.onresult = (e) => {
      // interim + final dono results se text nikalo
      let text = "";
      const results = e.results;
      if (results) {
        for (let i = 0; i < results.length; i++) {
          const r = results[i]?.[0]?.transcript;
          if (r) text += r + " ";
        }
      }
      text = text.trim();
      if (text) {
        setQ(text);
        setOpen(true);
      }
    };
    recog.onend = () => setListening(false);
    recog.onerror = (ev) => {
      setListening(false);
      // Mic permission denied ya koi error
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        toast.error(
          lang === "ur"
            ? "مائیک کی اجازت دیں — براؤزر سیٹنگز میں اجازت دیں"
            : "Please allow microphone access in your browser settings"
        );
      }
    };
    try {
      recog.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [q, products]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit() {
    if (!q.trim()) return;
    setOpen(false);
    router.push(`/shop?search=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center overflow-hidden rounded-full border bg-white/80 focus-within:ring-2 focus-within:ring-[#D21F26]/40 dark:bg-black/40">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={
            listening
              ? lang === "ur"
                ? "سن رہا ہوں... بولیں 🎤"
                : "Listening... speak now 🎤"
              : t.search.placeholder
          }
          className={
            compact
              ? "w-full bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              : "w-full bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground"
          }
          aria-label={t.header.search}
        />
        <button
          onClick={toggleVoice}
          aria-label={t.search.voiceSearch}
          title={t.search.voiceSearch}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
            listening
              ? "animate-pulse bg-[#D21F26] text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          onClick={submit}
          aria-label={t.header.search}
          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D21F26] text-white transition hover:bg-[#a8161c]"
        >
          <Search size={16} />
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-stone-950">
          {suggestions.map((p) => {
            const price = getProductPrice(p);
            return (
              <Link
                key={p.id}
                href={`/product/${p.slug || p.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-muted"
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={primaryImage(p)}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="44px"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p.name}
                  </span>
                  <span className="text-xs font-bold text-[#D21F26]">
                    {formatPKR(price.price)}
                  </span>
                </span>
              </Link>
            );
          })}
          <button
            onClick={submit}
            className="w-full border-t px-3 py-2.5 text-center text-sm font-semibold text-[#D21F26] transition hover:bg-muted"
          >
            {t.search.seeAllResults(q.trim())}
          </button>
        </div>
      )}
    </div>
  );
}
