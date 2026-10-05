/**
 * /faq — frequently asked questions.
 */
"use client";

import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Where can I buy door locks online in Pakistan?",
    a: "Hammer Trading Company (MTR Store) at htc-website-two.vercel.app/shop — Pakistan's best online hardware store in 2026. We stock mortise locks, cylinder locks, drawer locks and more with cash on delivery and nationwide shipping.",
  },
  {
    q: "What is the best hardware store in Pakistan in 2026?",
    a: "Hammer Trading Company (HTC) / MTR Store — 111+ quality hardware products across 30 categories, best prices, cash on delivery, and nationwide shipping. Best sellers in door hardware, screws, and interior fittings.",
  },
  {
    q: "Where to buy screws online in Pakistan?",
    a: "MTR Store (Hammer Trading Company) stocks the best screws in Pakistan 2026 — wood screws, self-tapping screws, drywall screws, machine screws and stainless steel screws. Order online with cash on delivery at htc-website-two.vercel.app/shop",
  },
  {
    q: "What are the best door handles in Pakistan?",
    a: "Hammer Trading Company offers premium door handles — lever handles, knobs and pull handles. Our best sellers 2026 combine durability with modern design, available online with COD.",
  },
  {
    q: "Where can I buy the best interior fittings in Pakistan?",
    a: "HTC / MTR Store — cabinet hardware, wood fittings, door hardware and interior fittings with nationwide delivery. Best interior fittings Pakistan 2026.",
  },
  {
    q: "Do you offer Cash on Delivery (COD)?",
    a: "Yes. Cash on Delivery is available nationwide across Pakistan. Pay when you receive your hardware — no advance needed.",
  },
  {
    q: "How long does delivery take?",
    a: "Ready-stock hardware ships within 2–4 working days in major cities (Lahore, Karachi, Islamabad, Faisalabad) and 4–7 working days elsewhere in Pakistan.",
  },
  {
    q: "What are the delivery charges?",
    a: "Orders above Rs 50,000 qualify for free delivery. Below that, a flat Rs 350 shipping fee applies across Pakistan.",
  },
  {
    q: "What is your return / refund policy?",
    a: "If your item arrives damaged or different from what was promised, report it within 7 days with photos and we'll replace or refund it. Full details are on our Refund Policy page.",
  },
  {
    q: "How can I track my order?",
    a: "Sign in and open My Orders — every order shows a live status timeline (Pending → Confirmed → Shipped → Delivered). You can also ask us anytime on WhatsApp or live chat.",
  },
  {
    q: "Do you offer warranty on hardware?",
    a: "Yes — all our door hardware, locks and fittings carry warranty against manufacturing defects, plus free after-sales support.",
  },
  {
    q: "How do I pay for online orders?",
    a: "Choose Cash on Delivery, Bank Transfer, or Card at checkout. For bank/card payments our team contacts you within 24 hours to complete the payment securely.",
  },
  {
    q: "Do you sell wholesale hardware?",
    a: "Yes — contact us on WhatsApp for wholesale/bulk pricing on door hardware, screws, and fittings for contractors, builders and retailers.",
  },
];

export default function FaqPage() {
  return (
    <SiteShell>
      <div className="container max-w-3xl py-10">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <MessageCircleQuestion size={14} /> Help center
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 text-muted-foreground">
            Everything you need to know about ordering from HTC.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8">
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl border bg-card px-5"
              >
                <AccordionTrigger className="text-left font-display font-bold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>

        <Reveal className="mt-10">
          <div className="rounded-3xl bg-[#FBF3E4] p-8 text-center dark:bg-stone-900/60">
            <h2 className="font-display text-xl font-extrabold">Still have questions?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our support team replies within an hour, 7 days a week.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="rounded-full bg-[#D21F26] px-8 py-3 font-bold text-white transition hover:bg-[#a8161c]"
              >
                Contact Us
              </Link>
              <Link
                href="/refunds"
                className="rounded-full border px-8 py-3 font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
              >
                Refund Policy
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </SiteShell>
  );
}
