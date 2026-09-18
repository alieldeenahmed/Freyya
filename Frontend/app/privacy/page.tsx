import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this site stores about you, and where.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Help"
      title="Privacy"
      intro="We collect very little. This page lists what the site does with it."
    >
      <PolicySection title="What stays on your device">
        <p>
          Your bag and the reviews you write are saved in your browser, and nowhere else. They
          never leave your device, and we cannot see them. A copy of your most recent order is
          kept there too, so the confirmation page still works after a refresh.
        </p>
        <p>
          Clearing your browser&apos;s site data removes them. So does using a private window
          once you close it.
        </p>
      </PolicySection>

      <PolicySection title="Orders">
        <p>
          When you place an order, your name, email, delivery address and the items you chose are
          saved on our server. That is how the order is processed and how you can look it up with
          its number and your email.
        </p>
        <p>
          No payment details are asked for or stored: payment is simulated. And because this is a
          demonstration, nobody packs or ships these orders.
        </p>
      </PolicySection>

      <PolicySection title="The contact form and the list">
        <p>
          The <Link href="/contact">contact form</Link> and the newsletter field in the footer
          check what you type and then discard it. Nothing is sent or stored.
        </p>
      </PolicySection>

      <PolicySection title="Cookies and tracking">
        <p>
          Shopping here sets no cookies. There is no analytics and no advertising or third-party
          scripts, and fonts are served from the site itself. The only cookie belongs to the
          store&apos;s private admin area and is set only when its owner signs in.
        </p>
      </PolicySection>

      <PolicySection title="Hosting">
        <p>
          Like any website, the host receives standard request information, such as your IP
          address and browser, when you load a page. That is handled under the host&apos;s own
          policy.
        </p>
      </PolicySection>

      <PolicySection title="A live store">
        <p>
          A live store would take real payments and send order emails. This page would then say
          how long orders are kept, who they are shared with, and how to ask for them to be
          corrected or deleted.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
