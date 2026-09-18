"use client";

import { useEffect, useRef } from "react";
import FadeImage from "@/components/FadeImage";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";

export default function CartDrawer() {
  const { items, isOpen, close, removeItem, updateQuantity } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (!panel || !overlay) return;

    if (prefersReducedMotion()) {
      gsap.set(panel, { x: isOpen ? 0 : "100%" });
      gsap.set(overlay, { autoAlpha: isOpen ? 1 : 0 });
      return;
    }

    gsap.to(panel, { x: isOpen ? 0 : "100%", duration: 0.5, ease: "power3.inOut" });
    gsap.to(overlay, { autoAlpha: isOpen ? 1 : 0, duration: 0.4 });
  }, [isOpen]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <div
        ref={overlayRef}
        onClick={close}
        className="invisible fixed inset-0 z-40 bg-text/30 opacity-0"
      />
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-sm translate-x-full flex-col bg-base px-6 py-6 sm:px-8"
      >
        <div className="flex items-center justify-between border-b border-secondary/40 pb-4">
          <h2 className="font-serif text-2xl text-text">Your Bag</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="text-text/60 transition-colors hover:text-accent"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-8 text-sm text-text/60">Your bag is empty.</p>
        ) : (
          <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="skeleton relative h-20 w-16 flex-shrink-0 overflow-hidden">
                  <FadeImage
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-serif text-lg text-text">{item.name}</p>
                  {item.variantName && (
                    <p className="text-xs uppercase tracking-wide text-text/50">
                      {item.variantName}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-text/70">${item.price}</p>
                  {item.quantity >= item.stock && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-accent">
                      Maximum available
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="h-8 w-8 border border-secondary/50 text-text/70 transition-colors hover:border-accent hover:text-accent"
                    >
                      −
                    </button>
                    <span className="text-sm text-text">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      aria-label="Increase quantity"
                      className="h-8 w-8 border border-secondary/50 text-text/70 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-secondary/50 disabled:hover:text-text/70"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="ml-auto text-xs uppercase tracking-wide text-text/40 transition-colors hover:text-accent"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-secondary/40 pt-6">
            <div className="flex items-center justify-between text-text">
              <span className="text-sm uppercase tracking-wide">Subtotal</span>
              <span className="font-serif text-xl">${subtotal}</span>
            </div>
            <button
              type="button"
              className="mt-4 w-full border border-text py-3 text-sm uppercase tracking-widest text-text transition-colors hover:border-accent hover:text-accent"
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
