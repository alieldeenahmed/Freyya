"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OrderSummary from "@/components/OrderSummary";
import Reveal from "@/components/Reveal";
import { getShippingMethod, useLastOrder } from "@/lib/orders";

export default function OrderConfirmation() {
  const router = useRouter();
  const order = useLastOrder();

  // Nothing to confirm (opened directly): send them to the shop.
  useEffect(() => {
    if (order === null) router.replace("/shop");
  }, [order, router]);

  if (!order) return <div className="mx-auto max-w-6xl" aria-busy="true" />;

  const shipping = getShippingMethod(order.shippingId);
  const firstName = order.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-accent">Order confirmed</p>
        <h1 className="mt-3 font-serif text-4xl text-text sm:text-6xl">
          Thank you, {firstName}.
        </h1>
        <p className="mt-6 max-w-md text-text/70">
          Your order is being prepared with care. Keep your order number close.
        </p>
        <p className="mt-8 inline-block border border-secondary/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-text">
          <span className="text-text/50">Order </span>
          {order.id}
        </p>
      </Reveal>

      <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_400px] lg:gap-24">
        <Reveal>
          <dl className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-text/50">Delivering to</dt>
              <dd className="mt-3 text-sm leading-relaxed text-text/80">
                {order.name}
                <br />
                {order.address.line1}
                {order.address.line2 && (
                  <>
                    <br />
                    {order.address.line2}
                  </>
                )}
                <br />
                {order.address.city}, {order.address.postalCode}
                <br />
                {order.address.country}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-text/50">Shipping</dt>
              <dd className="mt-3 text-sm leading-relaxed text-text/80">
                {shipping.label}
                <br />
                {shipping.eta}
              </dd>
              <dt className="mt-8 text-[11px] uppercase tracking-[0.2em] text-text/50">Contact</dt>
              <dd className="mt-3 text-sm text-text/80">{order.email}</dd>
            </div>
          </dl>

          <p className="mt-12 border-l border-accent pl-5 text-sm leading-relaxed text-text/60">
            This was a demonstration order. Nothing was charged, shipped or emailed.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/shop"
              className="border border-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:border-accent hover:text-accent"
            >
              Continue shopping
            </Link>
            <Link
              href="/quiz"
              className="text-xs uppercase tracking-[0.2em] text-text/60 transition-colors hover:text-text"
            >
              Find your shade
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="border border-secondary/50 p-6 sm:p-8">
            <h2 className="mb-6 font-serif text-2xl text-text">Your order</h2>
            <OrderSummary items={order.items} totals={order.totals} />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
