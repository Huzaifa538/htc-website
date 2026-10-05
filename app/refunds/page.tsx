/**
 * /refunds — refund & return policy.
 */
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function RefundsPage() {
  return (
    <SiteShell>
      <div className="container max-w-3xl py-10">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <ShieldCheck size={14} /> Shop with confidence
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Refund & Return Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: October 2026</p>
        </Reveal>

        <Reveal delay={0.05}>
          <Section title="1. 7-day damage & mismatch guarantee">
            <p>
              If your item arrives damaged, defective, or materially different
              from what was promised, report it within <strong>7 days</strong> of
              delivery with photos or a short video. We will repair it, replace
              it, or refund you in full — your choice.
            </p>
          </Section>
          <Section title="2. How to request">
            <ul className="list-disc space-y-2 pl-6">
              <li>Go to <Link href="/orders" className="font-bold text-[#D21F26] hover:underline">My Orders</Link> and note your order ID</li>
              <li>Message us on WhatsApp or live chat with the order ID and clear photos of the issue</li>
              <li>Our team inspects the claim within 48 hours and confirms the resolution</li>
            </ul>
          </Section>
          <Section title="3. Refund method & timeline">
            <p>
              Cash-on-delivery orders are refunded via bank transfer or mobile
              wallet within 5–7 working days of claim approval. Advance-paid
              orders are refunded to the original payment method. Delivery
              charges are refunded only when the fault is ours.
            </p>
          </Section>
          <Section title="4. Non-returnable items">
            <ul className="list-disc space-y-2 pl-6">
              <li>Custom-made furniture (size, fabric or finish made to your order) — unless damaged or defective</li>
              <li>Clearance / sale items marked final — unless damaged or defective</li>
              <li>Items damaged by misuse, accidents or normal wear after delivery</li>
            </ul>
          </Section>
          <Section title="5. Order cancellation">
            <p>
              Ready-stock orders can be cancelled free of charge before they are
              shipped — just message us. Custom orders can be cancelled before
              production begins; once production starts, the 50% advance is
              non-refundable.
            </p>
          </Section>
          <Section title="6. Warranty">
            <p>
              All solid-wood frames carry a 1-year warranty against
              manufacturing defects. Fabric, polish and consumable parts are
              covered for 90 days. Warranty claims follow the same reporting
              process above.
            </p>
          </Section>
        </Reveal>
      </div>
    </SiteShell>
  );
}
