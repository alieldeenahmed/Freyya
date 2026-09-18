"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="flex flex-1 items-center px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-sm uppercase tracking-widest text-accent-deep">Something went wrong</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight text-text sm:text-7xl">
          That didn&apos;t load.
        </h1>
        <p className="mt-6 max-w-md text-text/70">
          It&apos;s on our side. Try again, or head back to the shop.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={reset}
            className="border border-text bg-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text"
          >
            Try again
          </button>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
          >
            Back to the shop
          </Link>
        </div>
      </div>
    </section>
  );
}
