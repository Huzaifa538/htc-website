import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LanguageProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_URL,
} from "@/lib/seo";
import { getProductsSeo } from "@/lib/seo-catalog";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Urdu typeface for the اردو language toggle (loaded always, applied
// only when <html lang="ur"> via globals.css).
const urduFont = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu",
  display: "swap",
});

/**
 * Dynamic metadata: product names are fetched from Firestore and added
 * to keywords automatically. Any new product added in admin instantly
 * appears in SEO — no code changes needed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const productKeywords: string[] = [];
  try {
    const products = await getProductsSeo();
    // Add each product name + "buy X online Pakistan" variant.
    // Dedupe and cap at 200 to keep the meta tag reasonable.
    const seen = new Set<string>();
    for (const p of products) {
      const name = (p.name || "").trim();
      if (name.length < 4) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        productKeywords.push(name);
      }
      if (productKeywords.length >= 200) break;
    }
  } catch {
    // Fall back to static keywords only — never crash metadata.
  }

  const keywords = [...DEFAULT_KEYWORDS, ...productKeywords];

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_SHORT_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PK",
      url: SITE_URL,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [
        {
          url: "/logo.png",
          width: 512,
          height: 512,
          alt: "Hammer Trading Company logo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: ["/logo.png"],
    },
    icons: { icon: "/logo.png", apple: "/logo.png" },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#D21F26",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [],
  };
  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "MTR Store — Hammer Trading Company",
    url: `${SITE_URL}/shop`,
    image: `${SITE_URL}/logo.png`,
    description:
      "Pakistan's best online hardware store 2026 — door locks, handles, hinges, screws, wood fittings, cabinet hardware, tools & interior fittings at best prices with cash on delivery.",
    priceRange: "PKR",
    address: {
      "@type": "PostalAddress",
      addressCountry: "PK",
    },
    openingHours: "Mo-Sa 09:00-21:00",
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved language direction before first paint so
            Urdu (RTL) never flashes as LTR. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('htc-lang');if(l==='ur'){document.documentElement.lang='ur';document.documentElement.dir='rtl';}}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className={`${poppins.variable} ${inter.variable} ${urduFont.variable} antialiased`}>
        <LanguageProvider>
          <Providers>
            {children}
            <Toaster richColors position="top-center" />
          </Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
