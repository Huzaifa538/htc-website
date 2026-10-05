/**
 * /services — server wrapper with SEO metadata.
 * Interactive content lives in ./services-client.tsx.
 */
import type { Metadata } from "next";
import ServicesClient from "./services-client";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Interior Design & Hardware Services",
  description:
    "HTC services — professional interior design, door hardware installation guidance and consultation across Pakistan. Get a free quote from Hammer Trading Company.",
  keywords: [
    "interior design Pakistan",
    "door hardware installation",
    "HTC services",
    "Hammer Trading services",
    "hardware consultation",
  ],
  alternates: { canonical: canonicalUrl("/services") },
  openGraph: {
    title: "Interior Design & Hardware Services | HTC — Hammer Trading",
    description:
      "Professional interior design and hardware services by Hammer Trading Company. Get a free quote today.",
    url: canonicalUrl("/services"),
  },
};

export default function ServicesPage() {
  return <ServicesClient />;
}
