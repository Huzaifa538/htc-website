/**
 * Bot auto-switch — chat mein bot mode ka control.
 *
 * Firestore doc: siteSettings/chat
 *   { botEnabled, botAutoMode, adminLastSeen }
 *
 * Logic:
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

/** siteSettings/chat doc ka shape. */
export interface ChatBotSettings {
  /** Bot kul milakar on hai ya off (master switch). */
  botEnabled: boolean;
  /** true = admin ki online/offline status se auto switch. */
  botAutoMode: boolean;
  /** Admin ne aakhri baar kab /admin khola tha. */
  adminLastSeen?: { toMillis: () => number } | null;
}

const DEFAULTS: ChatBotSettings = {
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

/** Bot is waqt jawab dega ya nahi. */
export function isBotActive(s: ChatBotSettings | null): boolean {
  if (!s) return true; // doc na ho to default ON (pehle jaisa behavior)
  if (!s.botEnabled) return false;
  if (s.botAutoMode) return !isAdminOnline(s);
  return true;
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
          snap.exists()
            ? { ...DEFAULTS, ...(snap.data() as Partial<ChatBotSettings>) }
            : { ...DEFAULTS }
        );
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [configured]);

  return {
    settings,
    loaded,
    configured,
    botActive: isBotActive(settings),
    adminOnline: isAdminOnline(settings),
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
