"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.7, ease: "power3.out" }
    );
  }, [itemCount]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    if (prefersReducedMotion()) {
      gsap.set(menu, { autoAlpha: isMenuOpen ? 1 : 0 });
      return;
    }

    gsap.to(menu, {
      autoAlpha: isMenuOpen ? 1 : 0,
      y: isMenuOpen ? 0 : -8,
      duration: 0.3,
      ease: "power2.out",
    });
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-secondary/40 bg-base/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-10">
        <Link
          href="/"
          className="group relative justify-self-start pb-1 font-serif text-3xl font-semibold tracking-[0.06em] text-text sm:text-4xl"
        >
          Freyya
          <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-[0.28] bg-accent transition-transform duration-500 ease-out group-hover:scale-x-100" />
        </Link>

        <nav className="hidden items-center gap-10 sm:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative py-2 text-xs uppercase tracking-[0.2em] transition-colors hover:text-text ${
                  active ? "text-text" : "text-text/65"
                }`}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-px origin-center bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100 ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 justify-self-end">
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="flex h-11 w-11 items-center justify-center text-text transition-colors hover:text-accent-deep sm:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="16" x2="20" y2="16" />
            </svg>
          </button>

          <button
            type="button"
            onClick={open}
            data-cart-button
            aria-label="Cart"
            className="relative flex h-11 w-11 items-center justify-center text-text transition-colors hover:text-accent-deep"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 9V7.5a3.5 3.5 0 0 1 7 0V9" />
              <path d="M5.5 9h13l1 11.5a.5.5 0 0 1-.5.5h-14a.5.5 0 0 1-.5-.5L5.5 9Z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center overflow-hidden rounded-full bg-accent px-1 text-[10px] leading-none text-base">
                <span ref={badgeRef} className="block">
                  {itemCount}
                </span>
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        ref={menuRef}
        className="invisible absolute left-0 right-0 top-full flex flex-col border-b border-secondary/40 bg-base px-6 py-3 opacity-0 sm:hidden"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={closeMenu}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={`py-3 text-xs uppercase tracking-[0.2em] transition-colors hover:text-accent-deep ${
              isActive(link.href) ? "text-text" : "text-text/65"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
