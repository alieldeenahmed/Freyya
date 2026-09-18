"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import FadeImage from "@/components/FadeImage";
import { gsap } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/orders";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CartDrawer() {
  const { items, isOpen, close, removeItem, updateQuantity } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  // Modal behaviour: move focus in, keep it in, lock the page behind, and put
  // everything back (including focus) when the drawer closes.
  useEffect(() => {
    if (!isOpen) return;

    const site = document.getElementById("site-content");
    const html = document.documentElement;
    const opener = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - html.clientWidth;

    if (site) site.inert = true;
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    getLenis()?.stop();
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (site) site.inert = false;
      html.style.overflow = "";
      html.style.paddingRight = "";
      getLenis()?.start();

      const target = opener?.isConnected
        ? opener
        : document.querySelector<HTMLElement>("[data-cart-button]");
      target?.focus({ preventScroll: true });
    };
  }, [isOpen, close]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeShippingRemaining = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <>
      <div
        ref={overlayRef}
        onClick={close}
        aria-hidden
        className="invisible fixed inset-0 z-40 bg-text/30 opacity-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        inert={!isOpen}
        data-lenis-prevent
        className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-sm translate-x-full flex-col bg-base px-6 py-6 sm:px-8"
      >
        <div className="flex items-center justify-between border-b border-secondary/40 pb-4">
          <h2 className="font-serif text-2xl text-text">Your Bag</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center text-text/60 transition-colors hover:text-accent"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-8 text-sm text-text/60">Your bag is empty.</p>
        ) : (
          <div className="mt-6 flex-1 space-y-6 overflow-y-auto overscroll-contain">
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
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="h-8 w-8 border border-secondary/50 text-text/70 transition-colors hover:border-accent hover:text-accent"
                    >
                      −
                    </button>
                    <span className="text-sm text-text" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      aria-label={`Increase quantity of ${item.name}`}
                      className="h-8 w-8 border border-secondary/50 text-text/70 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-secondary/50 disabled:hover:text-text/70"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name} from bag`}
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
            <p
              className={`mt-3 text-xs ${
                freeShippingRemaining <= 0 ? "text-accent" : "text-text/50"
              }`}
            >
              {freeShippingRemaining <= 0
                ? "You've unlocked free standard shipping."
                : `Add $${freeShippingRemaining} more for free standard shipping.`}
            </p>
            <Link
              href="/checkout"
              onClick={close}
              className="mt-5 block w-full border border-text bg-text py-4 text-center text-sm uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text"
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
