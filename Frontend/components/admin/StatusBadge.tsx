import { STATUS_LABELS } from "@/lib/admin-types";
import type { OrderStatus } from "@/lib/orders";

// A gold dot marks the orders that need someone to act on them.
export default function StatusBadge({ status }: { status: OrderStatus }) {
  const needsAttention = status === "pending_payment" || status === "paid";

  return (
    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-text">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${needsAttention ? "bg-accent" : "bg-text/30"}`}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
