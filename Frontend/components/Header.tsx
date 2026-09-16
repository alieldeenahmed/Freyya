"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/quiz", label: "Shade Match" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const { itemCount, open } = useCart();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const badge = badgeRef.current;
    if (!badge || prefersReducedMotion()) return;

    gsap.fromTo(
      badge,
      { scale: 1.6 },
      { scale: 1, duration: 0.4, ease: "back.out(2)" }
    );
  }, [itemCount]);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-secondary/40 bg-base/90 px-6 py-5 backdrop-blur-sm sm:px-10">
      <Link href="/" className="font-serif text-2xl tracking-wide text-text">
        Freyya
      </Link>

      <nav className="hidden gap-8 text-sm tracking-wide text-text/80 sm:flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={open}
        aria-label="Cart"
        className="relative text-text transition-colors hover:text-accent"
      >
        <svg
          width="20"
          height="22"
          viewBox="0 0 20 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M5 7V5a5 5 0 0 1 10 0v2" />
          <rect x="1" y="7" width="18" height="14" rx="2" />
        </svg>
        {itemCount > 0 && (
          <span
            ref={badgeRef}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] leading-none text-base"
          >
            {itemCount}
          </span>
        )}
      </button>
    </header>
  );
}
