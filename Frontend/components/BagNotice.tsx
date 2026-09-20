"use client";

import { useCart } from "@/lib/cart-context";

// Says so when the shop changed the bag: an item sold out, was withdrawn, or was cut back to
// what is left. Without this the bag would just quietly get smaller.
export default function BagNotice({ className = "" }: { className?: string }) {
  const { bagChanges, acknowledgeBagChanges } = useCart();
  if (bagChanges.length === 0) return null;

  return (
    <div role="status" className={`border-l border-accent pl-5 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-accent-deep">Your bag changed</p>
      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-text/70">
        {bagChanges.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={acknowledgeBagChanges}
        className="mt-1 inline-flex min-h-11 items-center text-[10px] uppercase tracking-[0.2em] text-text transition-colors hover:text-accent-deep"
      >
        <span className="border-b border-accent pb-0.5">Got it</span>
      </button>
    </div>
  );
}
