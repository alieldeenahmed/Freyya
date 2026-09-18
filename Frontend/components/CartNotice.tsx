"use client";

import { useEffect, useRef } from "react";
import FadeImage from "@/components/FadeImage";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useCart } from "@/lib/cart-context";

const VISIBLE_FOR = 4.5;

// A quiet confirmation beside the bag. It dismisses itself, so the customer
// never has to close anything.
export default function CartNotice() {
  const { lastAdded, clearLastAdded, open } = useCart();
  const noticeRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const stamp = lastAdded?.stamp;

  useEffect(() => {
    const notice = noticeRef.current;
    const bar = barRef.current;
    if (!notice || !bar) return;

    if (stamp === undefined) {
      gsap.set(notice, { y: -8 });
      return;
    }

    if (prefersReducedMotion()) {
      gsap.set(notice, { autoAlpha: 1, y: 0 });
      const timer = window.setTimeout(clearLastAdded, VISIBLE_FOR * 1000);
      return () => window.clearTimeout(timer);
    }

    const tl = gsap.timeline();
    tl.to(notice, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" })
      .fromTo(bar, { scaleX: 1 }, { scaleX: 0, duration: VISIBLE_FOR, ease: "none" }, 0.3)
      .to(notice, {
        autoAlpha: 0,
        y: -8,
        duration: 0.6,
        ease: "power2.inOut",
        onComplete: clearLastAdded,
      });
    timelineRef.current = tl;

    return () => {
      tl.kill();
    };
  }, [stamp, clearLastAdded]);

  const handleView = () => {
    const notice = noticeRef.current;
    timelineRef.current?.kill();
    if (notice) {
      gsap.to(notice, {
        autoAlpha: 0,
        y: -8,
        duration: 0.3,
        ease: "power2.in",
        onComplete: clearLastAdded,
      });
    }
    open();
  };

  return (
    <div
      ref={noticeRef}
      role="status"
      aria-live="polite"
      onMouseEnter={() => timelineRef.current?.pause()}
      onMouseLeave={() => timelineRef.current?.resume()}
      className="invisible fixed right-4 top-[92px] z-[45] w-[calc(100vw-2rem)] max-w-sm border border-secondary/50 bg-base/95 opacity-0 shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--color-text)_45%,transparent)] backdrop-blur-sm sm:right-10"
    >
      <div className="flex items-center gap-4 p-4">
        <div className="skeleton relative h-[60px] w-12 shrink-0 overflow-hidden">
          {lastAdded && (
            <FadeImage
              src={lastAdded.image}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Added to your bag
          </p>
          <p className="mt-1 truncate font-serif text-lg leading-tight text-text">
            {lastAdded?.name}
          </p>
          {lastAdded?.variantName && (
            <p className="mt-0.5 text-xs text-text/50">{lastAdded.variantName}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleView}
          className="shrink-0 border-b border-accent pb-0.5 text-[10px] uppercase tracking-[0.2em] text-text transition-colors hover:text-accent"
        >
          View bag
        </button>
      </div>

      <div ref={barRef} className="h-px origin-left bg-accent" />
    </div>
  );
}
