/**
 * Footer — fully driven by the siteSettings document (logo, tagline,
 * socials, contact, quick links, newsletter signup to Firestore with a
 * mailto fallback when unconfigured).
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@/components/customer/social-icons";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { useSiteSettings } from "@/components/customer/data-hooks";
import { useLanguage } from "@/lib/i18n";
import { WhatsAppCatalogButton } from "@/components/customer/whatsapp-catalog-button";

const QUICK_LINKS = [
  { href: "/shop", key: "shop" },
  { href: "/services", key: "services" },
  { href: "/projects", key: "projects" },
  { href: "/gallery", key: "gallery" },
  { href: "/about", key: "aboutUs" },
  { href: "/contact", key: "contact" },
] as const;

const SUPPORT_LINKS = [
  { href: "/faq", key: "faq" },
  { href: "/orders", key: "trackOrder" },
  { href: "/refunds", key: "refundPolicy" },
  { href: "/privacy", key: "privacyPolicy" },
  { href: "/terms", key: "termsOfService" },
] as const;

export function Footer() {
  const { settings } = useSiteSettings();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const socials = [
    { href: settings?.facebookUrl, icon: FacebookIcon, label: "Facebook" },
    { href: settings?.instagramUrl, icon: InstagramIcon, label: "Instagram" },
    { href: settings?.tiktokUrl, icon: TiktokIcon, label: "TikTok" },
    { href: settings?.youtubeUrl, icon: YoutubeIcon, label: "YouTube" },
  ].filter((s) => s.href);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error(t.footer.validEmail);
      return;
    }
    setBusy(true);
    try {
      if (db && isFirebaseConfigured()) {
        // NOTE: `newsletters` is a customer-site collection not listed in
        // COLLECTIONS (deviation documented in the customer build handoff).
        await addDoc(collection(db, "newsletters"), {
          email: value,
          createdAt: serverTimestamp(),
        });
        toast.success(t.footer.subscribed);
      } else if (settings?.email) {
        window.location.href = `mailto:${settings.email}?subject=Newsletter%20subscribe&body=Please%20subscribe%20${encodeURIComponent(value)}`;
      } else {
        toast.success(t.footer.thanksPosted);
      }
      setEmail("");
    } catch {
      toast.error(t.footer.subscribeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="mt-20 bg-stone-950 text-stone-200 dark:bg-black dark:ring-1 dark:ring-white/10">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex flex-col items-start gap-1.5">
            <Image
              src={settings?.logoUrl || "/logo.png"}
              alt={settings?.siteName ?? "HTC — Hammer Trading"}
              width={140}
              height={48}
              className="h-12 w-auto rounded-lg bg-white p-1 object-contain"
            />
            <p className="text-[11px] font-semibold tracking-wide text-stone-400">
              Hammer Trading Company
            </p>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-400">
            {t.footer.tagline}
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href!}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#D21F26]"
              >
                <s.icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            {t.footer.quickLinks}
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-stone-400 transition hover:text-white">
                  {t.footer[l.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            {t.footer.support}
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SUPPORT_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-stone-400 transition hover:text-white">
                  {t.footer[l.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact + newsletter */}
        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            {t.footer.getInTouch}
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm text-stone-400">
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <Phone size={15} className="text-[#D21F26]" /> {settings.phone}
              </li>
            )}
            {settings?.email && (
              <li className="flex items-center gap-2">
                <Mail size={15} className="text-[#D21F26]" /> {settings.email}
              </li>
            )}
            {settings?.address && (
              <li className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-[#D21F26]" />
                {settings.address}
              </li>
            )}
          </ul>
          <WhatsAppCatalogButton phone={settings?.whatsappNumber} />
          <form onSubmit={subscribe} className="mt-5">
            <p className="mb-2 text-sm font-semibold text-white">
              {t.footer.dealsInbox}
            </p>
            <div className="flex overflow-hidden rounded-full bg-white/10 p-1 ring-1 ring-white/10 focus-within:ring-[#D21F26]">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.footer.yourEmail}
                type="email"
                className="w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-stone-500"
              />
              <button
                type="submit"
                disabled={busy}
                aria-label={t.footer.subscribe}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D21F26] text-white transition hover:bg-[#a8161c] disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-stone-500 sm:flex-row">
          <p>
            {t.footer.rightsReserved(new Date().getFullYear(), settings?.siteName ?? "HTC — Hammer Trading")}
          </p>
          <p className="text-stone-600 dark:text-stone-400">
            {t.footer.mtrLine}
          </p>
          <p className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">{t.footer.privacy}</Link>
            <Link href="/terms" className="hover:text-white">{t.footer.terms}</Link>
            <Link href="/refunds" className="hover:text-white">{t.footer.refunds}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
