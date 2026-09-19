"use client";

import { useRef, useState } from "react";
import Select from "@/components/Select";
import { Star } from "@/components/StarRating";
import type { Review } from "@/lib/types";

const LIMITS = { titleMin: 3, titleMax: 60, bodyMin: 20, bodyMax: 600, nameMin: 2, nameMax: 30 };

type Errors = Partial<Record<"rating" | "title" | "body" | "name", string>>;

const fieldClass =
  "w-full border-0 border-b border-secondary/60 bg-transparent py-3 text-text placeholder:text-text/65 transition-colors focus:border-accent focus:outline-none";
const labelClass = "text-[11px] uppercase tracking-[0.2em] text-text/65";

function StarInput({
  value,
  onChange,
  describedBy,
}: {
  value: number;
  onChange: (rating: number) => void;
  describedBy?: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // In a radio group the arrow keys move focus and select together, so the reader
  // announces the star you landed on.
  const choose = (next: number) => {
    onChange(next);
    buttons.current[next - 1]?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    // Move from the star that has focus, as a native radio group does, even before any is chosen.
    const from = buttons.current.findIndex((b) => b === document.activeElement) + 1 || value;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(Math.min(5, from + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      choose(Math.max(1, from - 1));
    }
  };

  return (
    <div
      id="review-rating"
      role="radiogroup"
      aria-label="Your rating"
      aria-describedby={describedBy}
      className="-ml-1 flex items-center"
      onMouseLeave={() => setHover(0)}
      onKeyDown={handleKey}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => {
            buttons.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <Star
            className={`h-7 w-7 transition-colors duration-200 ${
              n <= active ? "text-accent-deep" : "text-secondary/60"
            }`}
          />
        </button>
      ))}
      <span className="ml-3 text-[11px] uppercase tracking-[0.2em] text-text/65">
        {["", "Poor", "Fair", "Good", "Very good", "Excellent"][active]}
      </span>
    </div>
  );
}

export default function ReviewForm({
  productId,
  shades,
  onSubmit,
  onCancel,
}: {
  productId: string;
  shades?: string[];
  onSubmit: (review: Review) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [shade, setShade] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const next: Errors = {};
    if (!rating) next.rating = "Choose a star rating.";
    const t = title.trim();
    if (t.length < LIMITS.titleMin) next.title = "Give your review a short title.";
    const b = body.trim();
    if (b.length < LIMITS.bodyMin)
      next.body = `Tell us a little more — at least ${LIMITS.bodyMin} characters.`;
    if (name.trim().length < LIMITS.nameMin) next.name = "Add your first name.";
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const first = (["rating", "title", "body", "name"] as const).find((key) => found[key]);
    if (first) {
      // Send focus to the first mistake, as the checkout and contact forms do.
      const target =
        first === "rating"
          ? document.querySelector<HTMLElement>('#review-rating [role="radio"][tabindex="0"]')
          : document.getElementById(`review-${first}`);
      target?.focus();
      return;
    }

    onSubmit({
      id: `u-${Date.now()}`,
      productId,
      author: name.trim(),
      rating,
      title: title.trim(),
      body: body.trim(),
      date: new Date().toISOString().slice(0, 10),
      verified: false,
      variant: shade || undefined,
    });
  };

  const errorId = (key: keyof Errors) => `review-${key}-error`;
  const describe = (key: keyof Errors) => (errors[key] ? errorId(key) : undefined);

  const error = (key: keyof Errors) =>
    errors[key] ? (
      <p id={errorId(key)} role="alert" className="mt-2 text-xs text-accent-deep">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mb-10 border border-secondary/50 p-6 sm:p-8"
      aria-label="Write a review"
    >
      <h3 className="font-serif text-2xl text-text">Share your experience</h3>

      <div className="mt-6">
        <p className={labelClass}>Rating</p>
        <div className="mt-2">
          <StarInput value={rating} onChange={setRating} describedBy={describe("rating")} />
        </div>
        {error("rating")}
      </div>

      <div className="mt-6">
        <label htmlFor="review-title" className={labelClass}>
          Title
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          maxLength={LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describe("title")}
          placeholder="Sum it up in a few words"
          className={fieldClass}
        />
        {error("title")}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="review-body" className={labelClass}>
            Review
          </label>
          <span className="text-[11px] tabular-nums text-text/65">
            {body.length}/{LIMITS.bodyMax}
          </span>
        </div>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          maxLength={LIMITS.bodyMax}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={Boolean(errors.body)}
          aria-describedby={describe("body")}
          placeholder="What did you notice? How did it feel, look, last?"
          className={`${fieldClass} resize-none`}
        />
        {error("body")}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className={labelClass}>
            First name
          </label>
          <input
            id="review-name"
            type="text"
            value={name}
            maxLength={LIMITS.nameMax}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describe("name")}
            autoComplete="given-name"
            placeholder="Amira"
            className={fieldClass}
          />
          {error("name")}
        </div>

        {shades && shades.length > 0 && (
          <div>
            <label htmlFor="review-shade" className={labelClass}>
              Shade <span className="text-text/65">(optional)</span>
            </label>
            <Select
              id="review-shade"
              label="Shade"
              options={[{ id: "", label: "Not specified" }, ...shades.map((s) => ({ id: s, label: s }))]}
              value={shade}
              onChange={setShade}
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button
          type="submit"
          className="border border-text bg-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text"
        >
          Submit review
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
        >
          Cancel
        </button>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-text/65">
        Your review is saved on this device and appears right away.
      </p>
    </form>
  );
}
