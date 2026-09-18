import { describe, expect, it } from "vitest";
import { reviews } from "@/data/reviews";
import { getReviews, sortReviews, summarize } from "@/lib/reviews";
import { products } from "@/data/products";
import { findProduct } from "@/lib/products";
import type { Review } from "@/lib/types";

const review = (overrides: Partial<Review>): Review => ({
  id: "r",
  productId: "dawn-cleanse",
  author: "A.",
  rating: 5,
  title: "t",
  body: "b",
  date: "2026-01-01",
  verified: true,
  ...overrides,
});

describe("summarize", () => {
  it("handles no reviews", () => {
    expect(summarize([])).toEqual({
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it("averages to one decimal", () => {
    const list = [5, 5, 4].map((rating) => review({ rating }));
    expect(summarize(list).average).toBe(4.7);
  });

  it("counts each star level", () => {
    const list = [5, 5, 4, 3, 1].map((rating) => review({ rating }));
    expect(summarize(list).distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1, 5: 2 });
  });
});

describe("sortReviews", () => {
  it("puts the newest first", () => {
    const sorted = sortReviews([
      review({ id: "old", date: "2026-01-01" }),
      review({ id: "new", date: "2026-06-01" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("puts your own review first on the same day", () => {
    const sorted = sortReviews([
      review({ id: "theirs", date: "2026-06-01" }),
      review({ id: "mine", date: "2026-06-01", mine: true }),
    ]);
    expect(sorted[0].id).toBe("mine");
  });

  it("does not change the list it is given", () => {
    const list = [
      review({ id: "a", date: "2026-01-01" }),
      review({ id: "b", date: "2026-02-01" }),
    ];
    sortReviews(list);
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("seeded reviews", () => {
  it("all belong to a real product and use a 1 to 5 rating", () => {
    for (const r of reviews) {
      expect(findProduct(products, r.productId), r.id).toBeDefined();
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
    }
  });

  it("have unique ids", () => {
    expect(new Set(reviews.map((r) => r.id)).size).toBe(reviews.length);
  });

  it("are filtered by product", () => {
    expect(getReviews("veil-spf").every((r) => r.productId === "veil-spf")).toBe(true);
  });
});
