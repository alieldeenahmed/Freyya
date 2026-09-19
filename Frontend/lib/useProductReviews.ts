import { useMemo, useSyncExternalStore } from "react";
import { sortReviews, summarize } from "@/lib/reviews";
import type { RatingSummary, Review } from "@/lib/types";

// Reviews written on this device. The API stores the catalog, orders and stock but
// not reviews, so these live in localStorage. To move them server-side, replace
// read and write below with API calls.
const KEY = "freyya:reviews";
const EMPTY: Review[] = [];

const listeners = new Set<() => void>();
let cache: { raw: string | null; parsed: Review[] } = { raw: null, parsed: EMPTY };

function read(): Review[] {
  if (typeof window === "undefined") return EMPTY;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.parsed;
  }

  // Keep the same array identity until the stored value changes.
  if (raw === cache.raw) return cache.parsed;

  let parsed: Review[] = EMPTY;
  try {
    const data = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) parsed = data;
  } catch {
    parsed = EMPTY;
  }

  cache = { raw, parsed };
  return parsed;
}

function write(list: Review[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage can be blocked (private mode); keep the review for this session.
    cache = { raw: JSON.stringify(list), parsed: list };
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function addUserReview(review: Review) {
  write([{ ...review, mine: true }, ...read()]);
}

export function removeUserReview(id: string) {
  write(read().filter((review) => review.id !== id));
}

export function useProductReviews(
  productId: string,
  seeded: Review[]
): { reviews: Review[]; summary: RatingSummary; mine: Review[] } {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);

  return useMemo(() => {
    const mine = all.filter((review) => review.productId === productId);
    const reviews = sortReviews([...mine, ...seeded]);
    return { reviews, summary: summarize(reviews), mine };
  }, [all, productId, seeded]);
}
