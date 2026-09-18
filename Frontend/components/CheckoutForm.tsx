"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/Field";
import OrderSummary from "@/components/OrderSummary";
import { useCart } from "@/lib/cart-context";
import {
  describeCheckoutError,
  payForOrder,
  placeOrder,
  toOrderRequest,
  type CheckoutFields as Fields,
} from "@/lib/checkout";
import {
  COUNTRIES,
  SHIPPING_METHODS,
  computeTotals,
  saveOrder,
  type ShippingId,
} from "@/lib/orders";
import { useHydrated } from "@/lib/useHydrated";

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="flex items-baseline gap-4 border-b border-secondary/40 pb-4">
      <span className="font-serif text-2xl text-accent-deep">{number}</span>
      <span className="font-serif text-2xl text-text">{title}</span>
    </h2>
  );
}

export default function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { items, clear, removeItem, updateQuantity } = useCart();

  const [fields, setFields] = useState<Fields>({
    email: "",
    name: "",
    line1: "",
    line2: "",
    city: "",
    postalCode: "",
    country: COUNTRIES[0],
  });
  const [shippingId, setShippingId] = useState<ShippingId>("standard");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [placing, setPlacing] = useState(false);

  // One key per attempt. Resending the same request (say after a dropped connection)
  // returns the same order instead of making a second one; changing anything starts fresh.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const resetKey = () => setAttemptKey(crypto.randomUUID());

  const totals = computeTotals(items, shippingId);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    resetKey();
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!EMAIL.test(fields.email.trim())) next.email = "Enter a valid email address.";
    if (fields.name.trim().length < 2) next.name = "Enter your full name.";
    if (fields.line1.trim().length < 4) next.line1 = "Enter your street address.";
    if (fields.city.trim().length < 2) next.city = "Enter your city.";
    if (fields.postalCode.trim().length < 3) next.postalCode = "Enter your postal code.";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (placing || items.length === 0) return;

    const found = validate();
    setErrors(found);
    setSubmitError("");
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(`checkout-${first}`)?.focus();
      return;
    }

    setPlacing(true);
    try {
      const order = await placeOrder(toOrderRequest(fields, shippingId, items), attemptKey);
      // Payment is simulated on the server, but it is a separate step, as a real one would be.
      const paid = await payForOrder(order.id, order.email);

      saveOrder(paid);
      clear();
      router.push("/checkout/confirmation");
    } catch (error) {
      const lineNames = Object.fromEntries(items.map((item) => [item.id, item.name]));
      const problem = describeCheckoutError(error, lineNames);

      setSubmitError(problem.message);
      setErrors((prev) => ({ ...prev, ...problem.fieldErrors }));
      // The store said what is really available, so make the bag match it.
      for (const [id, available] of Object.entries(problem.stockLimits)) {
        if (available > 0) updateQuantity(id, available);
        else removeItem(id);
      }
      if (Object.keys(problem.stockLimits).length > 0) router.refresh();
      if (!problem.retryable) resetKey();

      const firstField = Object.keys(problem.fieldErrors)[0];
      if (firstField) document.getElementById(`checkout-${firstField}`)?.focus();
      setPlacing(false);
    }
  };

  const input = (key: keyof Fields, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => ({
    id: `checkout-${key}`,
    value: fields[key],
    onChange: set(key),
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `checkout-${key}-error` : undefined,
    className: fieldClass,
    ...extra,
  });

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-4xl text-text sm:text-5xl">Checkout</h1>
      </div>
    );
  }

  if (items.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-4xl text-text sm:text-5xl">Checkout</h1>
        <p className="mt-6 max-w-sm text-text/65">
          Your bag is empty. Add something you love and it will be waiting here.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-block border border-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:border-accent hover:text-accent-deep"
        >
          Shop all
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm uppercase tracking-widest text-accent-deep">Secure your order</p>
      <h1 className="mt-3 font-serif text-4xl text-text sm:text-5xl">Checkout</h1>

      <div className="mt-14 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_400px] lg:gap-24">
        <form onSubmit={handleSubmit} noValidate aria-label="Checkout" className="space-y-14">
          <section>
            <SectionHeading number="01" title="Contact" />
            <div className="mt-6">
              <Field id="checkout-email" label="Email" error={errors.email}>
                <input
                  {...input("email", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionHeading number="02" title="Delivery" />
            <div className="mt-6 space-y-6">
              <Field id="checkout-name" label="Full name" error={errors.name}>
                <input {...input("name", { autoComplete: "name" })} />
              </Field>
              <Field id="checkout-line1" label="Address" error={errors.line1}>
                <input {...input("line1", { autoComplete: "address-line1" })} />
              </Field>
              <Field id="checkout-line2" label="Apartment, suite" optional>
                <input {...input("line2", { autoComplete: "address-line2" })} />
              </Field>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field id="checkout-city" label="City" error={errors.city}>
                  <input {...input("city", { autoComplete: "address-level2" })} />
                </Field>
                <Field id="checkout-postalCode" label="Postal code" error={errors.postalCode}>
                  <input {...input("postalCode", { autoComplete: "postal-code" })} />
                </Field>
              </div>
              <Field id="checkout-country" label="Country">
                <select
                  id="checkout-country"
                  value={fields.country}
                  onChange={set("country")}
                  autoComplete="country-name"
                  className={`${fieldClass} -ml-1 w-[calc(100%+0.25rem)]`}
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section>
            <SectionHeading number="03" title="Shipping" />
            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Shipping method">
              {SHIPPING_METHODS.map((method) => {
                const cost = computeTotals(items, method.id).shipping;
                return (
                  <label
                    key={method.id}
                    className="flex cursor-pointer items-center justify-between gap-4 border border-secondary/50 p-5 transition-colors has-[:checked]:border-accent has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accent"
                  >
                    <span className="flex items-center gap-4">
                      <input
                        type="radio"
                        name="shipping"
                        value={method.id}
                        checked={shippingId === method.id}
                        onChange={() => {
                          setShippingId(method.id);
                          resetKey();
                        }}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className="flex h-4 w-4 items-center justify-center rounded-full border border-text/40 transition-colors peer-checked:border-accent"
                      >
                        <span
                          className={`h-2 w-2 rounded-full bg-accent transition-opacity ${
                            shippingId === method.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </span>
                      <span>
                        <span className="block text-sm text-text">{method.label}</span>
                        <span className="block text-xs text-text/65">{method.eta}</span>
                      </span>
                    </span>
                    <span className="text-sm text-text/80">{cost === 0 ? "Free" : `$${cost}`}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-text/65">
              See{" "}
              <Link
                href="/shipping-returns"
                className="border-b border-accent text-text transition-colors hover:text-accent-deep"
              >
                shipping &amp; returns
              </Link>{" "}
              for countries, times and how to send something back.
            </p>
          </section>

          <section>
            <SectionHeading number="04" title="Payment" />
            <div className="mt-6 border-l border-accent pl-5">
              <p className="text-sm leading-relaxed text-text/70">
                Payment is simulated. This is a demonstration store, so nothing is charged and
                no card details are collected. Your order is still recorded, and its stock is
                taken from the shelf.
              </p>
            </div>
          </section>

          <div>
            {submitError && (
              <p role="alert" className="mb-5 border-l border-accent pl-5 text-sm text-accent-deep">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={placing}
              className="w-full border border-text bg-text py-4 text-sm uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:px-14"
            >
              {placing ? "Placing order…" : `Place order · $${totals.total}`}
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-text/65">
              Demo order: nothing is charged, shipped or emailed.
            </p>
          </div>
        </form>

        <aside className="lg:sticky lg:top-32 lg:self-start" aria-label="Order summary">
          <div className="border border-secondary/50 p-6 sm:p-8">
            <h2 className="mb-6 font-serif text-2xl text-text">Your bag</h2>
            <OrderSummary items={items} totals={totals} showFreeShippingHint />
          </div>
          <Link
            href="/shop"
            className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
          >
            ← Keep shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
