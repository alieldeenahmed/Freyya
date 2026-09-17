"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

const VALUES = [
  {
    title: "Clean formulas",
    description:
      "No parabens, sulfates, or synthetic fragrance. Just what the skin needs.",
  },
  {
    title: "Cruelty-free",
    description: "Never tested on animals. Not now, not ever.",
  },
  {
    title: "Dermatologist-tested",
    description: "Every formula reviewed before it reaches you.",
  },
  {
    title: "Recyclable packaging",
    description: "Glass and recycled plastic. Nothing single-use.",
  },
];

export default function BrandValues() {
  const sectionRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const rows = rowRefs.current.filter((el): el is HTMLDivElement => !!el);

    const ctx = gsap.context(() => {
      gsap.from(rows, {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="border-t border-secondary/40 px-6 py-24 sm:px-10"
    >
      <div className="mx-auto max-w-3xl">
        {VALUES.map((value, i) => (
          <div
            key={value.title}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className="flex gap-6 border-b border-secondary/40 py-8 last:border-b-0 sm:gap-12"
          >
            <span className="font-serif text-2xl text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-serif text-2xl text-text">{value.title}</h3>
              <p className="mt-2 max-w-md text-text/70">
                {value.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
