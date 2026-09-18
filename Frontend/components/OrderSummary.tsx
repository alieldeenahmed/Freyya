import FadeImage from "@/components/FadeImage";
import type { CartItem } from "@/lib/cart-store";
import { FREE_SHIPPING_THRESHOLD, type Totals } from "@/lib/orders";

export default function OrderSummary({
  items,
  totals,
  showFreeShippingHint = false,
}: {
  items: CartItem[];
  totals: Totals;
  showFreeShippingHint?: boolean;
}) {
  const remaining = FREE_SHIPPING_THRESHOLD - totals.subtotal;

  return (
    <div>
      <ul className="divide-y divide-secondary/40">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 py-5 first:pt-0">
            <div className="skeleton relative h-20 w-16 flex-shrink-0 overflow-hidden">
              <FadeImage
                src={item.image}
                alt={item.name}
                fill
                sizes="64px"
                className="object-cover"
              />
              <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center bg-text px-1 text-[10px] text-base">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-tight text-text">{item.name}</p>
              {item.variantName && (
                <p className="mt-1 text-xs uppercase tracking-wide text-text/65">
                  {item.variantName}
                </p>
              )}
            </div>
            <p className="text-sm text-text/80">${item.price * item.quantity}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-3 border-t border-secondary/40 pt-6 text-sm">
        <div className="flex justify-between text-text/70">
          <dt>Subtotal</dt>
          <dd>${totals.subtotal}</dd>
        </div>
        <div className="flex justify-between text-text/70">
          <dt>Shipping</dt>
          <dd>{totals.shipping === 0 ? "Free" : `$${totals.shipping}`}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-secondary/40 pt-4 text-text">
          <dt className="text-xs uppercase tracking-[0.2em]">Total</dt>
          <dd className="font-serif text-3xl">${totals.total}</dd>
        </div>
      </dl>

      {showFreeShippingHint && remaining > 0 && (
        <p className="mt-6 text-xs text-text/65">
          Add ${remaining} more for free standard shipping.
        </p>
      )}
    </div>
  );
}
