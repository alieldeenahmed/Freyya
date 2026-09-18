import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="flex flex-1 items-center px-6 py-24 sm:px-10 sm:py-32">
      <Reveal className="mx-auto w-full max-w-4xl">
        <p className="text-sm uppercase tracking-widest text-accent-deep">404</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight text-text sm:text-7xl">
          This page isn&apos;t here.
        </h1>
        <p className="mt-6 max-w-md text-text/70">
          The link may be old, or the address mistyped. The shop is a good place to start.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Link
            href="/shop"
            className="border border-text bg-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text"
          >
            Shop all
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
          >
            Back home
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
