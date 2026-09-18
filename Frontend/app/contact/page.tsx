import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about an order, a shade or an ingredient? Write to us.",
  alternates: { canonical: "/contact" },
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function ContactPage() {
  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <Reveal>
          <p className="text-sm uppercase tracking-widest text-accent-deep">Contact</p>
          <h1 className="mt-3 font-serif text-4xl text-text sm:text-5xl">Say hello.</h1>
          <p className="mt-6 max-w-sm text-text/70">
            Questions about an order, a shade or an ingredient? Write to us.
          </p>

          {CONTACT_EMAIL && (
            <p className="mt-8 text-sm text-text/70">
              Or email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="border-b border-accent text-text transition-colors hover:text-accent-deep"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          )}

          <p className="mt-8 max-w-sm text-sm text-text/65">
            Looking for delivery times or returns? See{" "}
            <Link
              href="/shipping-returns"
              className="border-b border-accent text-text transition-colors hover:text-accent-deep"
            >
              Shipping &amp; returns
            </Link>
            .
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <ContactForm />
        </Reveal>
      </div>
    </div>
  );
}
