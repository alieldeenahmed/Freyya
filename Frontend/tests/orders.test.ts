import { describe, expect, it } from "vitest";
import { FREE_SHIPPING_THRESHOLD, computeTotals } from "@/lib/orders";

const line = (price: number, quantity = 1) => ({ price, quantity });

describe("computeTotals", () => {
  it("charges standard shipping below the threshold", () => {
    expect(computeTotals([line(FREE_SHIPPING_THRESHOLD - 1)], "standard")).toEqual({
      subtotal: 74,
      shipping: 6,
      total: 80,
    });
  });

  it("makes standard shipping free at the threshold", () => {
    expect(computeTotals([line(FREE_SHIPPING_THRESHOLD)], "standard")).toEqual({
      subtotal: 75,
      shipping: 0,
      total: 75,
    });
  });

  it("multiplies price by quantity", () => {
    expect(computeTotals([line(28, 2), line(58)], "standard").subtotal).toBe(114);
  });

  it("never waives express shipping", () => {
    expect(computeTotals([line(500)], "express")).toEqual({
      subtotal: 500,
      shipping: 14,
      total: 514,
    });
  });

  it("charges nothing for an empty cart", () => {
    expect(computeTotals([], "standard")).toEqual({ subtotal: 0, shipping: 0, total: 0 });
    expect(computeTotals([], "express").total).toBe(0);
  });
});
