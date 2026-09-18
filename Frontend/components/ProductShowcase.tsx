"use client";

import { useEffect, useRef } from "react";
import FadeImage from "@/components/FadeImage";
import type { Product } from "@/lib/types";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

const MOMENTS = ["The formula.", "The texture.", "The finish."];

export default function ProductShowcase({ product }: { product: Product }) {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    const panels = panelRefs.current.filter((el): el is HTMLDivElement => !!el);
    const dots = dotRefs.current.filter((el): el is HTMLSpanElement => !!el);

    if (!section || prefersReducedMotion() || panels.length < 2) return;

    // Scroll distance the sticky panel dwells for: one viewport per moment.
    section.style.height = `${MOMENTS.length * 100}vh`;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (i === 0) return;
        tl.to(panels[i - 1], { opacity: 0, duration: 1 }, i - 1).to(
          panel,
          { opacity: 1, duration: 1 },
          i - 1
        );
        if (dots[i - 1]) tl.to(dots[i - 1], { opacity: 0.4 }, i - 1);
        if (dots[i]) tl.to(dots[i], { opacity: 1 }, i - 1);
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        animation: tl,
      });
    }, sectionRef);

    return () => {
      ctx.revert();
      section.style.height = "";
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative w-full">
      <div className="sticky top-0 flex min-h-dvh w-full items-center bg-base px-6 py-24 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 sm:grid-cols-2">
          <div className="skeleton relative aspect-[4/5] w-full overflow-hidden">
            {MOMENTS.map((caption, i) => (
              <div
                key={caption}
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
                className="absolute inset-0 flex items-end p-6"
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                {product.showcase?.[i] && (
                  <FadeImage
                    src={product.showcase[i]}
                    alt={`${product.name} — ${caption}`}
                    fill
                    sizes="(min-width: 1152px) 552px, (min-width: 640px) 45vw, 100vw"
                    className="object-cover"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-text/45 to-transparent" />
                <span className="relative text-xs uppercase tracking-widest text-base">
                  {caption}
                </span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm uppercase tracking-widest text-accent">
              {product.category}
            </p>
            <h2 className="mt-2 font-serif text-4xl text-text sm:text-5xl">
              {product.name}
            </h2>
            <p className="mt-4 max-w-sm text-text/70">{product.tagline}</p>

            <ul className="mt-8 flex flex-wrap gap-3">
              {product.specs.map((spec) => (
                <li
                  key={spec}
                  className="border border-secondary/50 px-3 py-1 text-xs uppercase tracking-wide text-text/60"
                >
                  {spec}
                </li>
              ))}
            </ul>

            <p className="mt-8 font-serif text-2xl text-text">
              ${product.price}
            </p>

            <div className="mt-8 flex gap-2">
              {MOMENTS.map((caption, i) => (
                <span
                  key={caption}
                  ref={(el) => {
                    dotRefs.current[i] = el;
                  }}
                  className="h-1 w-8 bg-accent"
                  style={{ opacity: i === 0 ? 1 : 0.4 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
