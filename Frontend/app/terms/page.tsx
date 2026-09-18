import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using this site and buying from it.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Help"
      title="Terms"
      intro="The plain terms for using this site and ordering from it."
    >
      <PolicySection title="Using the site">
        <p>
          You can browse, take the quiz and place an order freely. Please don&apos;t misuse the
          site, try to break it, or copy it in bulk.
        </p>
      </PolicySection>

      <PolicySection title="Products and prices">
        <p>
          Prices are in US dollars. We describe each product as accurately as we can, but colours
          on a screen vary, and shades may look different in person.
        </p>
        <p>
          Stock is limited. If an item is no longer available after you order, we will tell you
          and refund it in full.
        </p>
      </PolicySection>

      <PolicySection title="Orders">
        <p>
          An order is confirmed when we send you an order number. We may cancel an order for
          reasons such as a pricing error or an address we cannot deliver to, and will refund
          anything you paid.
        </p>
        <p>
          Delivery and returns are covered in <Link href="/shipping-returns">Shipping & returns</Link>.
        </p>
      </PolicySection>

      <PolicySection title="Skin and safety">
        <p>
          Read the ingredients before you use a product. If you have sensitive skin or an
          allergy, patch test first, and stop using a product that irritates you. Product
          information is not medical advice.
        </p>
      </PolicySection>

      <PolicySection title="Reviews">
        <p>
          Reviews you write should be honest and about the product. In this demonstration they
          are saved on your device and are not shown to other visitors.
        </p>
      </PolicySection>

      <PolicySection title="Ownership">
        <p>
          The text, photography and design of this site belong to Freyya. Please don&apos;t reuse
          them without asking.
        </p>
      </PolicySection>

      <PolicySection title="Liability">
        <p>
          We are responsible for what we sell being as described and safe to use as directed. We
          are not liable for losses we could not reasonably have foreseen. Nothing here limits
          rights you have by law.
        </p>
      </PolicySection>

      <PolicySection title="Changes">
        <p>
          We may update these terms. The version on this page when you order is the one that
          applies to that order.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Questions about these terms? <Link href="/contact">Get in touch</Link>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
