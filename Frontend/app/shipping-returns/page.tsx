import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";
import { COUNTRIES, FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Shipping & returns",
  description: "Delivery options, costs and times, and how to return an order.",
  alternates: { canonical: "/shipping-returns" },
};

export default function ShippingReturnsPage() {
  return (
    <PolicyPage
      eyebrow="Help"
      title="Shipping & returns"
      intro="What delivery costs, how long it takes, and what to do if something isn't right."
    >
      <PolicySection title="Delivery">
        <ul>
          {SHIPPING_METHODS.map((method) => (
            <li key={method.id}>
              <span className="text-text">{method.label}</span>: ${method.price}, {method.eta}.
              {method.freeOver !== undefined && ` Free on orders of $${method.freeOver} or more.`}
            </li>
          ))}
        </ul>
        <p>
          Orders are prepared within one business day. Delivery times count from dispatch, not
          from the day you order.
        </p>
      </PolicySection>

      <PolicySection title="Where we ship">
        <p>{COUNTRIES.join(", ")}.</p>
        <p>
          Duties and import taxes, where they apply, are set by the destination country and are
          not included in the price.
        </p>
      </PolicySection>

      <PolicySection title="Tracking">
        <p>
          A tracking link is sent by email when your order leaves us. If it hasn&apos;t moved for
          five business days, <Link href="/contact">get in touch</Link>.
        </p>
      </PolicySection>

      <PolicySection title="Returns">
        <p>
          You can return an unopened product within 30 days of delivery for a full refund of the
          product price. Opened products can&apos;t be returned for hygiene reasons.
        </p>
        <p>
          Return postage is at your cost, unless the item arrived damaged or wrong. Refunds go
          back to the original payment method within seven business days of us receiving the
          parcel.
        </p>
      </PolicySection>

      <PolicySection title="Damaged or wrong items">
        <p>
          If something arrives damaged or isn&apos;t what you ordered, write to us within 14 days
          with your order number and a photo. We will replace it or refund it, and cover the
          postage.
        </p>
      </PolicySection>

      <PolicySection title="Shades">
        <p>
          Not sure of your shade? The <Link href="/quiz">shade quiz</Link> narrows it down. If
          you still get it wrong, an unopened shade can be returned as above.
        </p>
      </PolicySection>

      <p className="pt-10 text-sm text-text/65">
        Standard shipping is free from ${FREE_SHIPPING_THRESHOLD}. Checkout shows the exact cost
        before you place an order.
      </p>
    </PolicyPage>
  );
}
