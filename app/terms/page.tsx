/**
 * /terms — terms of service.
 */
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

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="container max-w-3xl py-10">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: October 2026</p>
        </Reveal>

        <Reveal delay={0.05}>
          <Section title="1. About HTC">
            <p>
              HTC — Hammer Trading (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates
              this online store selling furniture, home decor and interior
              design services across Pakistan.
            </p>
          </Section>
          <Section title="2. Orders & pricing">
            <p>
              All prices are in Pakistani Rupees (PKR) and include applicable
              taxes unless stated otherwise. An order is confirmed only after
              our team verifies it with you by phone or message. We reserve the
              right to cancel orders affected by pricing errors, stock issues
              or suspected fraud — any advance paid is refunded in full.
            </p>
          </Section>
          <Section title="3. Delivery">
            <p>
              Delivery timelines shown at checkout are estimates. Delays caused
              by weather, transport strikes or other events beyond our control
              do not qualify for compensation, but we always keep you informed.
              Please inspect your items on delivery and note any damage on the
              delivery receipt.
            </p>
          </Section>
          <Section title="4. Custom & made-to-order items">
            <p>
              Furniture made to your custom size, fabric or finish is produced
              specifically for you and cannot be resold — such orders require a
              50% advance and are non-cancellable once production begins, except
              in case of manufacturing defects.
            </p>
          </Section>
          <Section title="5. Interior design services">
            <p>
              Design projects are governed by a written quotation and work
              order agreed before execution. Timelines depend on site readiness
              and material availability; the dedicated project manager keeps
              you updated at every stage.
            </p>
          </Section>
          <Section title="6. Acceptable use">
            <p>
              You agree not to misuse this website — including fraudulent
              orders, fake reviews, or attempts to disrupt the service. We may
              suspend accounts that violate these terms.
            </p>
          </Section>
          <Section title="7. Liability">
            <p>
              To the maximum extent permitted by law, our liability for any
              order is limited to the amount you paid for that order. Product
              images are representative; minor variations in wood grain and
              fabric shade are natural and expected.
            </p>
          </Section>
          <Section title="8. Changes">
            <p>
              We may update these terms from time to time; the version on this
              page at the time of your order applies to that order.
            </p>
          </Section>
        </Reveal>
      </div>
    </SiteShell>
  );
}
