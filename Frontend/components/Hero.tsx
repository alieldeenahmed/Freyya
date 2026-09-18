"use client";

import { useEffect, useRef } from "react";
import FadeImage from "@/components/FadeImage";
import { prefersReducedMotion } from "@/lib/motion";

// Optional loop, e.g. "/hero.mp4". The still below doubles as the poster frame.
const HERO_VIDEO_SRC: string | null = null;
const HERO_IMAGE_SRC = "/hero.jpg";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <section className="skeleton relative flex h-dvh w-full items-end overflow-hidden">
      <FadeImage
        src={HERO_IMAGE_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[25%_center] sm:object-center"
      />

      {HERO_VIDEO_SRC && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          poster={HERO_IMAGE_SRC}
          loop
          muted
          playsInline
          preload="none"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-base/95 via-base/60 to-transparent sm:hidden" />

      <div className="relative z-10 w-full px-6 pb-20 sm:px-10 sm:pb-28">
        <div className="sm:ml-auto sm:w-[46%]">
          <h1
            style={{ animationDelay: "0.2s" }}
            className="hero-rise max-w-2xl font-serif text-5xl leading-tight text-text sm:text-6xl lg:text-7xl"
          >
            Your skin, but better.
          </h1>
          <p
            style={{ animationDelay: "0.35s" }}
            className="hero-rise mt-4 max-w-sm text-text/70"
          >
            Formulated with intention. Nothing else.
          </p>
        </div>
      </div>
    </section>
  );
}
