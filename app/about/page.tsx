/**
 * /about — server wrapper with SEO metadata.
 * Interactive content lives in ./about-client.tsx.
 */
import type { Metadata } from "next";
import AboutClient from "./about-client";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "About Hammer Trading Company (HTC) — Lahore's trusted hardware store since 2010. Genuine door locks, handles, hinges, epoxy resin and hand tools with cash on delivery across Pakistan.",
  keywords: [
    "about Hammer Trading Company",
    "HTC hardware store",
    "hardware shop Lahore",
    "door hardware Pakistan",
  ],
  alternates: { canonical: canonicalUrl("/about") },
  openGraph: {
    title: "About Us | HTC — Hammer Trading",
    description:
      "Hammer Trading Company — genuine door hardware and fittings, trusted by Pakistani homes and builders since 2010.",
    url: canonicalUrl("/about"),
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
