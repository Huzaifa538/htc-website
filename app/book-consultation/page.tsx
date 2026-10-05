/**
 * /book-consultation — server wrapper with SEO metadata.
 * Interactive form lives in ./book-consultation-client.tsx.
 */
import type { Metadata } from "next";
import BookConsultationClient from "./book-consultation-client";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a Free Consultation",
  description:
    "Book a free consultation with Hammer Trading Company — door hardware advice, interior design planning and quotes. Our team confirms your appointment quickly.",
  keywords: [
    "book consultation",
    "interior design consultation Pakistan",
    "hardware consultation",
    "HTC appointment",
  ],
  alternates: { canonical: canonicalUrl("/book-consultation") },
  openGraph: {
    title: "Book a Free Consultation | HTC — Hammer Trading",
    description:
      "Book a free consultation with Hammer Trading Company for hardware advice and interior design planning.",
    url: canonicalUrl("/book-consultation"),
  },
};

export default function BookConsultationPage() {
  return <BookConsultationClient />;
}
