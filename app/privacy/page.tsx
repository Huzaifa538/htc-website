/**
 * /privacy — privacy policy.
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

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="container max-w-3xl py-10">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: October 2026</p>
        </Reveal>

        <Reveal delay={0.05}>
          <Section title="1. Information we collect">
            <p>
              When you shop with HTC — Hammer Trading, we collect only what we
              need to serve you: your name, phone number, delivery address and
              email (when you provide it). Signing in with Google shares your
              basic profile (name, email, photo) with us. Support chats may
              include messages and images you choose to send.
            </p>
          </Section>
          <Section title="2. How we use your information">
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Process, deliver and support your orders</li>
              <li>Respond to inquiries, quotes and support chats</li>
              <li>Send order updates and (with your consent) promotional emails</li>
              <li>Improve our store, products and services</li>
            </ul>
          </Section>
          <Section title="3. What we never do">
            <p>
              We never sell your personal data to anyone. We never share it
              with advertisers or data brokers. Your phone number and address
              are used only for your orders and deliveries.
            </p>
          </Section>
          <Section title="4. Payments">
            <p>
              Card and bank-transfer payments are coordinated directly with our
              team — we do not store your card numbers or bank credentials on
              our servers.
            </p>
          </Section>
          <Section title="5. Cookies & analytics">
            <p>
              We use minimal, privacy-friendly cookies for sign-in sessions,
              your cart, and theme preference. We do not run invasive
              cross-site tracking.
            </p>
          </Section>
          <Section title="6. Your rights">
            <p>
              You can ask us anytime to view, correct or delete your personal
              data, or to unsubscribe from promotional messages. Contact us via
              the Contact page or WhatsApp and we will act within 7 days.
            </p>
          </Section>
          <Section title="7. Contact">
            <p>
              For any privacy question, reach us through the Contact page —
              we take every request seriously.
            </p>
          </Section>
        </Reveal>
      </div>
    </SiteShell>
  );
}
