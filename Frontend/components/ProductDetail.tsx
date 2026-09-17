"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { gsap, Flip } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";
import { useMagnetic } from "@/lib/useMagnetic";

export default function ProductDetail({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0]);
  const [justAdded, setJustAdded] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { addItem } = useCart();

  useMagnetic(addButtonRef, 0.25);

  const activeColor = selectedVariant?.hex ?? product.color;

  const handleAddToBag = () => {
    addItem({
      id: selectedVariant ? `${product.id}:${selectedVariant.id}` : product.id,
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: product.price,
      color: activeColor,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);

    const button = addButtonRef.current;
    if (button && !prefersReducedMotion()) {
      gsap.fromTo(
        button,
        { scale: 0.94 },
        { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
      );
    }
  };

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;

    const key = `freyya:flip:${product.id}`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return;

    sessionStorage.removeItem(key);

    if (prefersReducedMotion()) return;

    const rect = JSON.parse(stored) as {
      top: number;
      left: number;
      width: number;
      height: number;
    };

    const state = Flip.getState(el);

    gsap.set(el, {
      position: "fixed",
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      zIndex: 50,
    });

    Flip.from(state, {
      duration: 0.7,
      ease: "power2.inOut",
      absolute: true,
      onComplete: () => {
        gsap.set(el, {
          clearProps: "position,top,left,width,height,zIndex",
        });
      },
    });
  }, [product.id]);

  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 sm:grid-cols-2">
        <div
          ref={imageRef}
          className="aspect-[4/5] w-full transition-colors duration-500"
          style={{
            background: `linear-gradient(160deg, ${activeColor}, var(--color-base))`,
          }}
        />

        <div>
          <p className="text-sm uppercase tracking-widest text-accent">
            {product.category}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-text sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-4 max-w-sm text-text/70">{product.tagline}</p>
          <p className="mt-4 max-w-sm text-sm text-text/60">
            {product.description}
          </p>

          <ul className="mt-8 flex flex-wrap gap-3">
            {product.specs.map((spec) => (
              <li
                key={spec}
                className="border border-secondary/50 px-3 py-1 text-xs uppercase tracking-wide text-text/60"
              >
                {spec}
              </li>
            ))}
          </ul>

          <p className="mt-8 font-serif text-2xl text-text">
            ${product.price}
          </p>

          {product.variants && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-text/50">
                Shade — {selectedVariant?.name}
              </p>
              <div className="mt-3 flex gap-3">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    aria-label={variant.name}
                    onClick={() => setSelectedVariant(variant)}
                    className="h-11 w-11 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: variant.hex,
                      borderColor:
                        selectedVariant?.id === variant.id
                          ? "var(--color-text)"
                          : "transparent",
                      transform:
                        selectedVariant?.id === variant.id
                          ? "scale(1.1)"
                          : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAddToBag}
            className="mt-10 w-full border border-text py-3 text-sm uppercase tracking-widest text-text transition-colors hover:border-accent hover:text-accent sm:w-auto sm:px-10"
          >
            {justAdded ? "Added" : "Add to Bag"}
          </button>

          <Link
            href="/shop"
            className="mt-12 inline-block text-sm uppercase tracking-widest text-text/60 transition-colors hover:text-accent"
          >
            ← Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}
