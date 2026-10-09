/**
 * Referral card (profile page).
 *
 * - Apna code dikhao: copy + WhatsApp share.
 * - Dost ka code lagao: naya customer ho to referredBy set ho jata hai,
 *   pehle order par dono ko 200 points bonus milte hain.
 */
"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Gift, Send } from "lucide-react";
import { toast } from "sonner";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { referralCodeFor, normalizeReferralCode, REFERRAL_BONUS_POINTS } from "@/lib/referral";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function ReferralCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [referred, setReferred] = useState(false);

  // Apna code: doc mein hai to wahi, nahi to banao aur save karo
  useEffect(() => {
    if (!user || !db || !isFirebaseConfigured()) return;
    (async () => {
      try {
        const ref = doc(db, COLLECTIONS.users, user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { referralCode?: string; referredBy?: string } | undefined;
        if (data?.referredBy) setReferred(true);
        if (data?.referralCode) {
          setCode(data.referralCode);
        } else {
          const fresh = referralCodeFor(user.uid);
          setCode(fresh);
          await setDoc(ref, { referralCode: fresh }, { merge: true });
        }
      } catch {
        setCode(referralCodeFor(user.uid));
      }
    })();
  }, [user]);

  if (!user) return null;

  function copy() {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error(t.referral.copyFailed)
    );
  }

  function shareWhatsApp() {
    const text = t.referral.shareText(code);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function applyFriendCode() {
    const normalized = normalizeReferralCode(friendCode);
    if (!normalized || !user) return;
    setApplying(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/referral/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: normalized }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setReferred(true);
        toast.success(t.referral.applied(REFERRAL_BONUS_POINTS));
      } else {
        const key = data.error as keyof typeof t.referral.errors | undefined;
        toast.error((key && t.referral.errors[key]) ?? t.referral.errors.failed);
      }
    } catch {
      toast.error(t.referral.errors.failed);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="mt-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl">
          <Gift size={22} className="text-emerald-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-extrabold">{t.referral.title}</p>
          <p className="text-xs text-muted-foreground">
            {t.referral.subtitle(REFERRAL_BONUS_POINTS)}
          </p>
        </div>
      </div>

      {/* Apna code */}
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl bg-white/70 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest dark:bg-black/30">
          {code || "…"}
        </code>
        <button
          onClick={copy}
          aria-label={t.referral.copy}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button
          onClick={shareWhatsApp}
          aria-label={t.referral.share}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white transition hover:brightness-95"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Dost ka code */}
      {!referred ? (
        <div className="mt-3 flex gap-2">
          <input
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value)}
            placeholder={t.referral.friendCodePlaceholder}
            className="min-w-0 flex-1 rounded-xl border bg-white/70 px-4 py-2 text-sm uppercase outline-none placeholder:normal-case focus:ring-2 focus:ring-emerald-500/40 dark:bg-black/30"
          />
          <Button
            onClick={applyFriendCode}
            disabled={applying || !friendCode.trim()}
            className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            {applying ? "…" : t.referral.apply}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          ✓ {t.referral.referredDone}
        </p>
      )}
    </div>
  );
}
