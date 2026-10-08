/**
 * Language context — Urdu/English toggle for the storefront.
 *
 * Usage in any client component:
 *   const { lang, setLang, t } = useLanguage();
 *   <h1>{t.nav.home}</h1>
 *
 * - `t` is the full dictionary in the active language. Any key missing
 *   from Urdu silently falls back to English (deep-merged at runtime).
 * - Choice persists in localStorage ("htc-lang"), defaults to English.
 * - Toggles `dir="rtl"` / `lang="ur"` on <html> when Urdu is active.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dictionary, type Language } from "./en";
import { ur } from "./ur";

const STORAGE_KEY = "htc-lang";

/** Deep-merge `over` onto `base` so missing Urdu keys fall back to English. */
function merge(base: unknown, over: unknown): unknown {
  if (
    base !== null &&
    over !== null &&
    typeof base === "object" &&
    typeof over === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(over) &&
    typeof base !== "function" &&
    typeof over !== "function"
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
    return out;
  }
  return over === undefined ? base : over;
}

function readStored(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "ur" ? "ur" : "en";
  } catch {
    return "en";
  }
}

function applyToDocument(lang: Language) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ur" ? "rtl" : "ltr";
}

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  /** Active dictionary (Urdu merged over English fallback). */
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start English to match the server render; hydrate the saved choice
  // on mount to avoid a hydration mismatch.
  const [lang, setLangState] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setLangState(stored);
    applyToDocument(stored);
    setReady(true);
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    applyToDocument(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable — language still works for this session */
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === "ur" ? "en" : "ur";
      applyToDocument(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useMemo(
    () => merge(en, lang === "ur" ? ur : {}) as Dictionary,
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  // Hold the first paint until we've read the stored language so the
  // correct direction/font applies without a flash. The inline script in
  // layout.tsx already sets dir/lang pre-paint; this just gates React.
  if (!ready) {
    return (
      <LanguageContext.Provider
        value={{ lang: "en", setLang, toggleLang, t: en }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
