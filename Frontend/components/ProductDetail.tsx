"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import FadeImage from "@/components/FadeImage";
import ProductAccordion from "@/components/ProductAccordion";
import StarRating from "@/components/StarRating";
import type { Product, Review } from "@/lib/types";
import { gsap, Flip } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";
import { getStock } from "@/lib/products";
import { useProductReviews } from "@/lib/useProductReviews";

const LOW_STOCK = 5;

export default function ProductDetail({
  product,
  reviews,
}: {
  product: Product;
  reviews: Review[];
}) {
  const { summary: rating } = useProductReviews(product.id, reviews);
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0]);
  const [justAdded, setJustAdded] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLSpanElement>(null);
  const wipeTimeline = useRef<gsap.core.Timeline | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const { items, addItem } = useCart();

  const activeColor = selectedVariant?.hex ?? product.color;
  const activeImage = selectedVariant?.image ?? product.image;
  const gallery = product.variants?.map((v) => v.image) ?? [product.image];

  const itemId = selectedVariant
    ? `${product.id}:${selectedVariant.id}`
    : product.id;
  const stock = getStock(product, selectedVariant?.id);
  const inBag = items.find((i) => i.id === itemId)?.quantity ?? 0;
  const soldOut = stock <= 0;
  const capReached = !soldOut && inBag >= stock;
  // Keep the button live while its "Added" confirmation plays out.
  const unavailable = soldOut || (capReached && !justAdded);

  const handleAddToBag = () => {
    if (unavailable) return;

    addItem({
      id: itemId,
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: product.price,
      color: activeColor,
      image: activeImage,
      stock,
    });

    setJustAdded(true);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setJustAdded(false), 2000);

    // Gold sweeps across the button, holds, then draws back.
    const wipe = wipeRef.current;
    if (!wipe) return;
    wipeTimeline.current?.kill();

    if (prefersReducedMotion()) {
      gsap.set(wipe, { scaleX: 1 });
      wipeTimeline.current = gsap.timeline().set(wipe, { scaleX: 0 }, 2);
      return;
    }

    wipeTimeline.current = gsap
      .timeline()
      .set(wipe, { transformOrigin: "0% 50%" })
      .to(wipe, { scaleX: 1, duration: 0.7, ease: "power3.inOut" })
      .set(wipe, { transformOrigin: "100% 50%" }, "+=1")
      .to(wipe, { scaleX: 0, duration: 0.7, ease: "power3.inOut" });
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

    // Hold the copy over the real image until it has loaded, then dissolve it,
    // so a slow connection never shows a blank frame or the skeleton mid-flight.
    let dissolved = false;
    const dissolve = () => {
      if (dissolved) return;
      dissolved = true;
      gsap.to(ghost, {
        opacity: 0,
        duration: 0.35,
        ease: "power1.out",
        onComplete: () => {
          ghost.remove();
          sessionStorage.removeItem(key);
        },
      });
    };

    const finish = () => {
      el.style.visibility = "";
      const realImg = el.querySelector("img");
      if (!realImg || (realImg.complete && realImg.naturalWidth > 0)) {
        dissolve();
        return;
      }
      realImg.addEventListener("load", dissolve, { once: true });
      window.setTimeout(dissolve, 2500);
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
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-12 sm:grid-cols-2">
        <div className="sm:sticky sm:top-32">
          <div
            ref={imageRef}
            className="skeleton relative aspect-[4/5] w-full overflow-hidden"
          >
            {gallery.map((src, i) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  src === activeImage ? "opacity-100" : "opacity-0"
                }`}
              >
                <FadeImage
                  src={src}
                  alt={
                    product.variants
                      ? `${product.name} in ${product.variants[i].name}`
                      : product.name
                  }
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 512px, (min-width: 640px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div ref={textRef}>
          <p className="text-sm uppercase tracking-widest text-accent-deep">
            {product.category}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-text sm:text-5xl">
            {product.name}
          </h1>
          {rating.count > 0 && (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("reviews")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="group mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-text/65 transition-colors hover:text-text"
            >
              <StarRating rating={rating.average} size="h-3.5 w-3.5" />
              <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-accent">
                {rating.average.toFixed(1)} · {rating.count}{" "}
                {rating.count === 1 ? "review" : "reviews"}
              </span>
            </button>
          )}
          <p className="mt-4 max-w-sm text-text/70">{product.tagline}</p>
          <p className="mt-4 max-w-sm text-sm text-text/65">
            {product.description}
          </p>

          <ul className="mt-8 flex flex-wrap gap-3">
            {product.specs.map((spec) => (
              <li
                key={spec}
                className="border border-secondary/50 px-3 py-1 text-xs uppercase tracking-wide text-text/65"
              >
                {spec}
              </li>
            ))}
          </ul>

          <p className="mt-8 font-serif text-2xl text-text">${product.price}</p>
          <p
            className={`mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] ${
              soldOut
                ? "text-text/65"
                : stock <= LOW_STOCK
                  ? "text-accent-deep"
                  : "text-text/65"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                soldOut
                  ? "bg-text/30"
                  : stock <= LOW_STOCK
                    ? "bg-accent"
                    : "bg-text/40"
              }`}
            />
            {soldOut
              ? "Sold out"
              : stock <= LOW_STOCK
                ? `Only ${stock} left`
                : `${stock} in stock`}
          </p>

          {product.variants && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-text/65">
                Shade — {selectedVariant?.name}
              </p>
              <div className="mt-3 flex gap-3">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    aria-label={
                      variant.stock <= 0
                        ? `${variant.name} (sold out)`
                        : variant.name
                    }
                    onClick={() => setSelectedVariant(variant)}
                    className={`h-11 w-11 rounded-full border-2 transition-transform hover:scale-110 ${
                      variant.stock <= 0 ? "opacity-40" : ""
                    }`}
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
            type="button"
            onClick={handleAddToBag}
            disabled={unavailable}
            className="relative mt-10 block w-full max-w-sm overflow-hidden border border-text bg-text py-4 text-center text-sm uppercase tracking-[0.2em] text-base transition-colors duration-300 enabled:hover:text-accent disabled:cursor-not-allowed disabled:border-text/20 disabled:bg-transparent disabled:text-text/65"
          >
            <span
              ref={wipeRef}
              aria-hidden
              className="absolute inset-0 bg-accent"
              style={{ transform: "scaleX(0)", transformOrigin: "0% 50%" }}
            />
            <span
              className={`relative transition-colors duration-[250ms] ${
                justAdded ? "text-text delay-[350ms]" : ""
              }`}
            >
              {justAdded
                ? "Added to bag"
                : soldOut
                  ? "Sold out"
                  : capReached
                    ? `All ${stock} in your bag`
                    : "Add to bag"}
            </span>
          </button>

          <ProductAccordion details={product.details} />

          <div className="mt-8 max-w-sm">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
            >
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:-translate-x-1"
              >
                ←
              </span>
              Back to shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
