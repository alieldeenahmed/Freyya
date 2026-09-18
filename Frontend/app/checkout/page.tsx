import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout — Freyya",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <CheckoutForm />
    </div>
  );
}
