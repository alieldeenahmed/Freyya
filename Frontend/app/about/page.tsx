import type { Metadata } from "next";
import Link from "next/link";
import BrandValues from "@/components/BrandValues";
import FadeImage from "@/components/FadeImage";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About — Freyya",
  description: "Six products. Each one earns its place.",
};

const LEFT_OUT = [
  "Parabens",
  "Sulfates",
  "Synthetic fragrance",
  "Mineral oil",
  "Drying alcohols",
];

const KEPT_IN = [
  "Niacinamide",
  "Hyaluronic acid",
  "Ceramides",
  "Squalane",
  "Vitamin C",
];

export default function AboutPage() {
  return (
    <>
      <section className="px-6 pb-20 pt-24 sm:px-10 sm:pb-28 sm:pt-32">
        <Reveal className="mx-auto max-w-4xl">
          <p className="text-sm uppercase tracking-widest text-accent">About</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-text sm:text-7xl">
            Skincare without the noise.
          </h1>
          <p className="mt-6 max-w-md text-text/70">
            Freyya makes six products. Each one earns its place.
          </p>
        </Reveal>
      </section>

      <div className="mx-auto h-px w-16 bg-accent" />

      <section className="px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 sm:grid-cols-2 sm:gap-20">
          <Reveal>
            <div className="skeleton relative aspect-[4/5] w-full overflow-hidden">
              <FadeImage
                src="/showcase/golden-hour-serum-1.jpg"
                alt="Golden serum pooled on glass"
                fill
                sizes="(min-width: 1152px) 528px, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-sm uppercase tracking-widest text-accent">
              The name
            </p>
            <h2 className="mt-3 font-serif text-4xl text-text sm:text-5xl">
              Named for Freyja.
            </h2>
            <p className="mt-6 max-w-md text-text/70">
              In Norse myth, Freyja is the goddess of love and beauty. We kept
              the name and changed the spelling.
            </p>
            <p className="mt-4 max-w-md text-text/70">
              We kept the idea too. Beauty is something you tend — not
              something you chase.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-secondary/40 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm uppercase tracking-widest text-accent">
              Ingredients
            </p>
            <h2 className="mt-3 font-serif text-4xl text-text sm:text-5xl">
              Nothing hidden.
            </h2>
            <p className="mt-6 max-w-md text-text/70">
              Every ingredient is listed in plain language. If it is not here,
              it is not in the bottle.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-20">
            <Reveal>
              <h3 className="text-xs uppercase tracking-widest text-text/50">
                Left out
              </h3>
              <ul className="mt-4">
                {LEFT_OUT.map((item) => (
                  <li
                    key={item}
                    className="border-b border-secondary/40 py-4 font-serif text-2xl text-text/60"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <h3 className="text-xs uppercase tracking-widest text-text/50">
                Kept in
              </h3>
              <ul className="mt-4">
                {KEPT_IN.map((item) => (
                  <li
                    key={item}
                    className="border-b border-secondary/40 py-4 font-serif text-2xl text-text"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <BrandValues />

      <section className="border-t border-secondary/40 px-6 py-24 sm:px-10 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-4xl text-text sm:text-5xl">
            Start with your shade.
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-text/70">
            Five questions. One match.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/quiz"
              className="border border-text px-8 py-3 text-sm uppercase tracking-widest text-text transition-colors hover:border-accent hover:text-accent"
            >
              Shade match
            </Link>
            <Link
              href="/shop"
              className="px-8 py-3 text-sm uppercase tracking-widest text-text/60 transition-colors hover:text-accent"
            >
              Shop all
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
