const STAR =
  "M10 1.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.6l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7L10 1.6Z";

export function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d={STAR} fill="currentColor" />
    </svg>
  );
}

// Filled stars are clipped to the fractional rating, so 4.6 reads as 4.6.
export default function StarRating({
  rating,
  size = "h-4 w-4",
}: {
  rating: number;
  size?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-secondary/60`} />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={`${size} max-w-none text-accent`} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
