"use client";

import Link from "next/link";
import FadeImage from "@/components/FadeImage";
import { useRef } from "react";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const imageRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    const el = imageRef.current;
    if (!el) return;

    // Measure the frame, not the hover-scaled image inside it.
    const rect = el.getBoundingClientRect();
    const src = el.querySelector("img")?.currentSrc ?? product.image;

    sessionStorage.setItem(
      `freyya:flip:${product.id}`,
      JSON.stringify({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        src,
        color: product.color,
        at: Date.now(),
      })
    );
  };

  return (
    <Link href={`/shop/${product.id}`} onClick={handleClick} className="group block">
      <div ref={imageRef} className="skeleton aspect-[4/5] w-full overflow-hidden">
        <div className="relative h-full w-full transition-transform duration-500 ease-out group-hover:scale-105">
          <FadeImage
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 384px, (min-width: 640px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-widest text-text/50">
          {product.category}
        </p>
        <h3 className="mt-1 font-serif text-xl text-text transition-colors group-hover:text-accent">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-text/70">${product.price}</p>
      </div>
    </Link>
  );
}
