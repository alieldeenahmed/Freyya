"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import StarRating from "@/components/StarRating";
import type { RatingSummary, Review } from "@/lib/types";

const INITIAL_COUNT = 3;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ProductReviews({
  productName,
  reviews,
  summary,
}: {
  productName: string;
  reviews: Review[];
  summary: RatingSummary;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reviews : reviews.slice(0, INITIAL_COUNT);

  return (
    <section
      id="reviews"
      className="scroll-mt-28 border-t border-secondary/40 px-6 py-24 sm:px-10 sm:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-sm uppercase tracking-widest text-accent">Reviews</p>
          <h2 className="mt-3 font-serif text-4xl text-text sm:text-5xl">
            In their words.
          </h2>
        </Reveal>

        {reviews.length === 0 ? (
          <p className="mt-10 text-text/60">
            No reviews for {productName} yet.
          </p>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-24">
            <Reveal>
              <div className="flex items-end gap-4">
                <span className="font-serif text-7xl leading-none text-text">
                  {summary.average.toFixed(1)}
                </span>
                <div className="pb-2">
                  <StarRating rating={summary.average} />
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-text/50">
                    {summary.count} {summary.count === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>

              <ul className="mt-10 space-y-3" aria-label="Rating breakdown">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const count = summary.distribution[star];
                  const pct = summary.count ? (count / summary.count) * 100 : 0;
                  return (
                    <li key={star} className="flex items-center gap-4 text-xs text-text/60">
                      <span className="w-3 tabular-nums">{star}</span>
                      <span className="relative h-px flex-1 bg-secondary/50">
                        <span
                          className="absolute inset-y-0 left-0 h-[3px] -translate-y-px bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-4 text-right tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            <div>
              <ul>
                {visible.map((review) => (
                  <li
                    key={review.id}
                    className="border-b border-secondary/40 py-8 first:pt-0"
                  >
                    <StarRating rating={review.rating} />
                    <h3 className="mt-4 font-serif text-2xl text-text">
                      {review.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-text/70">
                      {review.body}
                    </p>
                    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-text/50">
                      <span className="text-text/70">{review.author}</span>
                      {review.verified && (
                        <span className="text-accent">Verified buyer</span>
                      )}
                      {review.variant && <span>Shade: {review.variant}</span>}
                      <span>{formatDate(review.date)}</span>
                    </p>
                  </li>
                ))}
              </ul>

              {reviews.length > INITIAL_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-8 border-b border-accent pb-0.5 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:text-accent"
                >
                  {showAll
                    ? "Show fewer"
                    : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
