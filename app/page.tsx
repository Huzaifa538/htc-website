/**
 * / — homepage (server wrapper).
 *
 * The interactive homepage lives in ./home-client.tsx; this server shell
 * provides SEO metadata plus Organization JSON-LD.
 */
import type { Metadata } from "next";
import HomeClient from "./home-client";
import { JsonLd, organizationSchema } from "@/components/customer/json-ld";
import {
  absoluteUrl,
  canonicalUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: DEFAULT_TITLE },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: canonicalUrl("/") },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: absoluteUrl("/"),
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Hammer Trading Company logo",
      },
    ],
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <HomeClient />
    </>
  );
}
