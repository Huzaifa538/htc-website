/**
 * /contact — server wrapper with SEO metadata.
 * Interactive content lives in ./contact-client.tsx.
 */
import type { Metadata } from "next";
import ContactClient from "./contact-client";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Hammer Trading Company (HTC) — questions about door locks, handles, hinges or your order? Message us, call, or reach us on WhatsApp. We reply 7 days a week.",
  keywords: [
    "contact Hammer Trading Company",
    "HTC contact",
    "hardware store contact Lahore",
    "door hardware support Pakistan",
  ],
  alternates: { canonical: canonicalUrl("/contact") },
  openGraph: {
    title: "Contact Us | HTC — Hammer Trading",
    description:
      "Get in touch with Hammer Trading Company — WhatsApp, phone, or the contact form. We reply 7 days a week.",
    url: canonicalUrl("/contact"),
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
