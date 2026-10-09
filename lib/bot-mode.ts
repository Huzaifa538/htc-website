/**
 * Bot auto-switch — chat mein do alag bots ka control.
 *
 * Firestore doc: siteSettings/chat
 *   {
 *     htc: { botEnabled, botAutoMode },   // purple — services/interior
 *     mtr: { botEnabled, botAutoMode },   // blue — products/shop
 *     adminLastSeen                        // shared heartbeat
 *   }
 *
 * Logic (har brand ke liye alag):
 * - botEnabled OFF → bot kabhi jawab nahi dega
 * - botAutoMode ON → admin offline ho to bot ON, online ho to OFF
 * - botAutoMode OFF → botEnabled hi faisla karega (manual mode)
 *
 * Admin jab /admin par ho to har 30 sec mein adminLastSeen update
 * hota hai. 2 min se purana = offline.
 */
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { ChatBrand } from "@/lib/types";

/** Ek brand ke bot ki settings. */
export interface BrandBotSettings {
  /** Bot kul milakar on hai ya off (master switch). */
  botEnabled: boolean;
  /** true = admin ki online/offline status se auto switch. */
  botAutoMode: boolean;
}

/** siteSettings/chat doc ka shape. */
export interface ChatBotSettings {
  htc: BrandBotSettings;
  mtr: BrandBotSettings;
  /** Admin ne aakhri baar kab /admin khola tha. */
  adminLastSeen?: { toMillis: () => number } | null;
}

const BRAND_DEFAULTS: BrandBotSettings = {
  botEnabled: true,
  botAutoMode: true,
};

/** 2 min se zyada purana lastSeen = admin offline. */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isAdminOnline(s: ChatBotSettings | null): boolean {
  if (!s?.adminLastSeen) return false;
  try {
    return Date.now() - s.adminLastSeen.toMillis() < ONLINE_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Is brand ka bot is waqt jawab dega ya nahi. */
export function isBotActiveForBrand(
  s: ChatBotSettings | null,
  brand: ChatBrand
): boolean {
  if (!s) return true; // doc na ho to default ON (pehle jaisa behavior)
  const b = s[brand] ?? BRAND_DEFAULTS;
  if (!b.botEnabled) return false;
  if (b.botAutoMode) return !isAdminOnline(s);
  return true;
}

/** Purane flat doc ({botEnabled, botAutoMode}) ko naye shape mein lao. */
function normalize(
  data: Record<string, unknown> | undefined
): ChatBotSettings {
  const fresh = (): ChatBotSettings => ({
    htc: { ...BRAND_DEFAULTS },
    mtr: { ...BRAND_DEFAULTS },
  });
  if (!data) return fresh();
  const out = fresh();
  for (const brand of ["htc", "mtr"] as const) {
    const b = data[brand] as Partial<BrandBotSettings> | undefined;
    if (b && typeof b === "object") {
      if (typeof b.botEnabled === "boolean") out[brand].botEnabled = b.botEnabled;
      if (typeof b.botAutoMode === "boolean") out[brand].botAutoMode = b.botAutoMode;
    } else {
      // purana flat format — dono brands par lagao
      if (typeof data.botEnabled === "boolean")
        out[brand].botEnabled = data.botEnabled as boolean;
      if (typeof data.botAutoMode === "boolean")
        out[brand].botAutoMode = data.botAutoMode as boolean;
    }
  }
  const lastSeen = data.adminLastSeen as ChatBotSettings["adminLastSeen"];
  if (lastSeen) out.adminLastSeen = lastSeen;
  return out;
}

/** siteSettings/chat ko real-time suno. */
export function useBotMode() {
  const [settings, setSettings] = useState<ChatBotSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db) {
      setLoaded(true);
      return;
    }
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.siteSettings, "chat"),
      (snap) => {
        setSettings(
          normalize(
            snap.exists()
              ? (snap.data() as Record<string, unknown>)
              : undefined
          )
        );
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [configured]);

  const adminOnline = isAdminOnline(settings);

  return {
    settings,
    loaded,
    configured,
    adminOnline,
    /** brand do: "htc" | "mtr" */
    botActiveFor: (brand: ChatBrand) => isBotActiveForBrand(settings, brand),
  };
}

/**
 * Admin heartbeat — /admin layout mein lagao.
 * Har 30 sec mein adminLastSeen update karta hai taake
 * customer side ko pata chale admin online hai.
 */
export function useAdminHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isFirebaseConfigured() || !db) return;
    let stopped = false;

    const ping = () => {
      if (stopped || !db) return;
      setDoc(
        doc(db, COLLECTIONS.siteSettings, "chat"),
        { adminLastSeen: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    };

    ping(); // foran ek ping
    const id = setInterval(ping, 30_000); // phir har 30 sec
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [enabled]);
}
