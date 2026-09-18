"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import ReviewForm from "@/components/ReviewForm";
import StarRating from "@/components/StarRating";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { addUserReview, removeUserReview, useProductReviews } from "@/lib/useProductReviews";
import type { Review } from "@/lib/types";

const INITIAL_COUNT = 3;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ProductReviews({
  productId,
  productName,
  seeded,
  shades,
}: {
  productId: string;
  productName: string;
  seeded: Review[];
  shades?: string[];
}) {
  const { reviews, summary, mine } = useProductReviews(productId, seeded);
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [justPosted, setJustPosted] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const visible = showAll ? reviews : reviews.slice(0, INITIAL_COUNT);
  const hasReviewed = mine.length > 0;

  const openForm = () => {
    setFormKey((k) => k + 1);
    setFormOpen(true);
    window.setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      350
    );
  };

  const handleSubmit = (review: Review) => {
    addUserReview(review);
    setFormOpen(false);
    setJustPosted(review.id);
  };

  // Bring the new review into view and let it settle in gently.
  useEffect(() => {
    if (!justPosted) return;
    const el = document.getElementById(`review-${justPosted}`);
    if (!el) return;

    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!prefersReducedMotion()) {
        gsap.fromTo(
          el,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }
        );
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [justPosted]);

  const trigger = hasReviewed ? (
    <p className="mt-10 max-w-[16rem] text-xs leading-relaxed text-text/50">
      Thank you for reviewing. Your review is saved on this device.
    </p>
  ) : (
    <button
      type="button"
      onClick={openForm}
      aria-expanded={formOpen}
      className="mt-10 border border-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-text transition-colors duration-300 hover:border-accent hover:text-accent"
    >
      Write a review
    </button>
  );

  const formPanel = (
    <div
      ref={formRef}
      inert={!formOpen}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${
        formOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <ReviewForm
          key={formKey}
          productId={productId}
          shades={shades}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </div>
    </div>
  );

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
          <div className="mt-10 max-w-xl">
            <p className="text-text/60">
              No reviews for {productName} yet. Be the first to share yours.
            </p>
            {trigger}
            <div className="mt-10">{formPanel}</div>
          </div>
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
                          className="absolute inset-y-0 left-0 h-[3px] -translate-y-px bg-accent transition-[width] duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-4 text-right tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>

              {trigger}
            </Reveal>

            <div>
              {formPanel}

              <ul>
                {visible.map((review) => (
                  <li
                    key={review.id}
                    id={`review-${review.id}`}
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
                      {review.mine ? (
                        <span className="text-accent">Your review</span>
                      ) : (
                        review.verified && (
                          <span className="text-accent">Verified buyer</span>
                        )
                      )}
                      {review.variant && <span>Shade: {review.variant}</span>}
                      <span>{formatDate(review.date)}</span>
                      {review.mine && (
                        <button
                          type="button"
                          onClick={() => removeUserReview(review.id)}
                          className="text-text/40 transition-colors hover:text-text"
                        >
                          Remove
                        </button>
                      )}
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
                  {showAll ? "Show fewer" : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
