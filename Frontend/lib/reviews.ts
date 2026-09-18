import { reviews } from "@/data/reviews";
import type { RatingSummary, Review } from "@/lib/types";

export function sortReviews(list: Review[]): Review[] {
  return [...list].sort(
    (a, b) => b.date.localeCompare(a.date) || Number(Boolean(b.mine)) - Number(Boolean(a.mine))
  );
}

export function getReviews(productId: string): Review[] {
  return sortReviews(reviews.filter((review) => review.productId === productId));
}

export function summarize(list: Review[]): RatingSummary {
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of list) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
  }

  const average = list.length
    ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10
    : 0;

  return { average, count: list.length, distribution };
}
