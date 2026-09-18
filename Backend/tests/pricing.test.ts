import { describe, expect, it } from "vitest";
import { canTransition, allowedNext } from "../src/domain/order-status.js";
import { generateOrderId } from "../src/domain/order-id.js";
import { FREE_SHIPPING_THRESHOLD_CENTS, computeTotals } from "../src/domain/pricing.js";

describe("computeTotals", () => {
  it("charges standard shipping below the threshold", () => {
    expect(computeTotals(FREE_SHIPPING_THRESHOLD_CENTS - 1, "standard")).toEqual({
      subtotalCents: 7499,
      shippingCents: 600,
      totalCents: 8099,
    });
  });

  it("makes standard shipping free at the threshold", () => {
    expect(computeTotals(FREE_SHIPPING_THRESHOLD_CENTS, "standard")).toEqual({
      subtotalCents: 7500,
      shippingCents: 0,
      totalCents: 7500,
    });
  });

  it("never waives express shipping", () => {
    expect(computeTotals(50_000, "express").shippingCents).toBe(1400);
  });

  it("charges nothing for an empty subtotal", () => {
    expect(computeTotals(0, "standard")).toEqual({
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});

describe("order status rules", () => {
  it("follows the normal path", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("does not skip steps or go backwards", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("paid", "delivered")).toBe(false);
    expect(canTransition("shipped", "paid")).toBe(false);
  });

  it("only cancels before shipping, and only refunds after", () => {
    expect(canTransition("paid", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("paid", "refunded")).toBe(false);
    expect(canTransition("delivered", "refunded")).toBe(true);
  });

  it("treats cancelled and refunded as final", () => {
    expect(allowedNext("cancelled")).toEqual([]);
    expect(allowedNext("refunded")).toEqual([]);
  });
});

describe("generateOrderId", () => {
  it("looks like FRY- followed by seven readable characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOrderId()).toMatch(/^FRY-[A-HJ-NP-Z2-9]{7}$/);
    }
  });

  it("does not repeat in a small sample", () => {
    const ids = new Set(Array.from({ length: 200 }, generateOrderId));
    expect(ids.size).toBe(200);
  });
});
