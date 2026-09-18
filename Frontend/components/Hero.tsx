"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

// Optional loop, e.g. "/hero.mp4". The still below doubles as the poster frame.
const HERO_VIDEO_SRC: string | null = null;
const HERO_IMAGE_SRC = "/hero.jpg";

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
      <Image
        src={HERO_IMAGE_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[25%_center] sm:object-center"
      />

      {HERO_VIDEO_SRC && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          poster={HERO_IMAGE_SRC}
          autoPlay={!reducedMotion}
          loop={!reducedMotion}
          muted
          playsInline
          preload="none"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-base/95 via-base/60 to-transparent sm:hidden" />

      <div className="relative z-10 w-full px-6 pb-20 sm:px-10 sm:pb-28">
        <div className="sm:ml-auto sm:w-[46%]">
          <h1
            ref={headlineRef}
            className="max-w-2xl font-serif text-5xl leading-tight text-text sm:text-6xl lg:text-7xl"
          >
            Your skin, but better.
          </h1>
          <p ref={taglineRef} className="mt-4 max-w-sm text-text/70">
            Formulated with intention. Nothing else.
          </p>
        </div>
      </div>
    </section>
  );
}
