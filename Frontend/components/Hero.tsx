"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

// Swap in a real asset later, e.g. "/hero.mp4" — falls back to a gradient until then.
const HERO_VIDEO_SRC: string | null = null;
const HERO_POSTER_SRC = "/hero-poster.jpg";

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReducedMotion(reduced);

    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap.from([headlineRef.current, taglineRef.current], {
        opacity: 0,
        y: 24,
        duration: 1,
        stagger: 0.15,
        ease: "power2.out",
        delay: 0.2,
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative flex h-dvh w-full items-end overflow-hidden bg-base">
      {HERO_VIDEO_SRC ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          poster={HERO_POSTER_SRC}
          autoPlay={!reducedMotion}
          loop={!reducedMotion}
          muted
          playsInline
          preload="none"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 via-base to-base" />
      )}

      <div className="relative z-10 px-6 pb-20 sm:px-10 sm:pb-28">
        <h1
          ref={headlineRef}
          className="max-w-2xl font-serif text-5xl leading-tight text-text sm:text-7xl"
        >
          Your skin, but better.
        </h1>
        <p ref={taglineRef} className="mt-4 max-w-sm text-text/70">
          Formulated with intention. Nothing else.
        </p>
      </div>
    </section>
  );
}
