import type { Metadata } from "next";
import OrderConfirmation from "@/components/OrderConfirmation";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export default function ConfirmationPage() {
  return (
    <div className="min-h-dvh px-6 py-16 sm:px-10 sm:py-24">
      <OrderConfirmation />
    </div>
  );
}
