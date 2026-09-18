"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const textRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { addItem } = useCart();

  useMagnetic(addButtonRef, 0.25);

  const activeColor = selectedVariant?.hex ?? product.color;
  const activeImage = selectedVariant?.image ?? product.image;
  const gallery = product.variants?.map((v) => v.image) ?? [product.image];

  const handleAddToBag = () => {
    addItem({
      id: selectedVariant ? `${product.id}:${selectedVariant.id}` : product.id,
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: product.price,
      color: activeColor,
      image: activeImage,
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

  // Runs before paint so the finished image never flashes ahead of the morph.
  useLayoutEffect(() => {
    const el = imageRef.current;
    if (!el) return;

    const key = `freyya:flip:${product.id}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;

    const from = JSON.parse(raw) as {
      top: number;
      left: number;
      width: number;
      height: number;
      src: string;
      color: string;
      at: number;
    };

    if (prefersReducedMotion() || Date.now() - from.at > 4000) {
      sessionStorage.removeItem(key);
      return;
    }

    // The new page starts at the top; settle that before measuring the target.
    window.scrollTo(0, 0);

    // A fixed copy of the card image flies to the real one, so the grid never
    // reflows and the text column stays put.
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      top: `${from.top}px`,
      left: `${from.left}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      background: from.color,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "40",
      willChange: "transform",
    });
    const ghostImg = document.createElement("img");
    ghostImg.src = from.src;
    ghostImg.alt = "";
    Object.assign(ghostImg.style, {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    });
    ghost.appendChild(ghostImg);
    document.body.appendChild(ghost);
    el.style.visibility = "hidden";

    const finish = () => {
      sessionStorage.removeItem(key);
      ghost.remove();
      el.style.visibility = "";
    };

    const ctx = gsap.context(() => {
      const textItems = textRef.current?.children;
      if (textItems) {
        gsap.from(textItems, {
          opacity: 0,
          y: 16,
          duration: 0.7,
          stagger: 0.06,
          delay: 0.35,
          ease: "power2.out",
        });
      }

      Flip.fit(ghost, el, {
        scale: true,
        duration: 0.85,
        ease: "power3.inOut",
        onComplete: finish,
      });
    });

    return () => {
      ctx.revert();
      ghost.remove();
      el.style.visibility = "";
    };
  }, [product.id]);

  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 sm:grid-cols-2">
        <div
          ref={imageRef}
          className="relative aspect-[4/5] w-full overflow-hidden"
          style={{ background: activeColor }}
        >
          {gallery.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt={
                product.variants
                  ? `${product.name} in ${product.variants[i].name}`
                  : product.name
              }
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 512px, (min-width: 640px) 45vw, 100vw"
              className={`object-cover transition-opacity duration-500 ${
                src === activeImage ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>

        <div ref={textRef}>
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
