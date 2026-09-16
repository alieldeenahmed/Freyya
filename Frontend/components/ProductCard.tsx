"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const imageRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    const el = imageRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    sessionStorage.setItem(
      `freyya:flip:${product.id}`,
      JSON.stringify({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    );
  };

  return (
    <Link href={`/shop/${product.id}`} onClick={handleClick} className="group block">
      <div
        ref={imageRef}
        className="aspect-[4/5] w-full"
        style={{
          background: `linear-gradient(160deg, ${product.color}, var(--color-base))`,
        }}
      />
      <div className="mt-4">
        <p className="text-xs uppercase tracking-widest text-text/50">
          {product.category}
        </p>
        <h3 className="mt-1 font-serif text-xl text-text">{product.name}</h3>
        <p className="mt-1 text-sm text-text/70">${product.price}</p>
      </div>
    </Link>
  );
}
