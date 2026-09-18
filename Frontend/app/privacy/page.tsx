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
          Three things are saved in your browser, and nowhere else: your bag, the reviews you
          write, and your most recent order. They never leave your device, and we cannot see
          them.
        </p>
        <p>
          Clearing your browser&apos;s site data removes them. So does using a private window
          once you close it.
        </p>
      </PolicySection>

      <PolicySection title="Checkout">
        <p>
          Checkout asks for your name, email and delivery address so it can show an order
          confirmation. In this demonstration the details are kept in your browser only. They are
          not sent to a server, and no payment details are requested.
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
          The site sets no cookies, runs no analytics and loads no advertising or third-party
          scripts. Fonts are served from the site itself.
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
          A live store would need to keep orders on a server to fulfil them. This page would then
          say what is kept, why, for how long, who it is shared with, and how to ask for it to be
          corrected or deleted.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
