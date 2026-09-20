import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { describeCheckoutError, toOrderRequest, type CheckoutFields } from "@/lib/checkout";

const fields: CheckoutFields = {
  email: "  sara@example.com ",
  name: " Sara Nasser ",
  line1: "12 Nile Corniche",
  line2: "   ",
  city: "Cairo",
  postalCode: "11511",
  country: "Egypt",
};

describe("toOrderRequest", () => {
  it("sends what to buy and where, and nothing about price", () => {
    const request = toOrderRequest(fields, "express", [
      { id: "golden-hour-serum", quantity: 2 },
      { id: "freyya-balm:bare", quantity: 1 },
    ]);

    expect(request).toEqual({
      email: "sara@example.com",
      name: "Sara Nasser",
      address: { line1: "12 Nile Corniche", city: "Cairo", postalCode: "11511", country: "Egypt" },
      shippingId: "express",
      items: [
        { skuId: "golden-hour-serum", quantity: 2 },
        { skuId: "freyya-balm:bare", quantity: 1 },
      ],
    });
    expect(JSON.stringify(request)).not.toMatch(/price|total/i);
  });

  it("keeps a second address line only when there is one", () => {
    const withLine = toOrderRequest({ ...fields, line2: " Flat 4 " }, "standard", []);
    expect(withLine.address.line2).toBe("Flat 4");
    expect("line2" in toOrderRequest(fields, "standard", []).address).toBe(false);
  });
});

describe("describeCheckoutError", () => {
  const error = (status: number, code: string, message: string, details?: unknown) =>
    new ApiError(status, code, message, details);

  it("points at the fields the server rejected", () => {
    const problem = describeCheckoutError(
      error(400, "validation_error", "Invalid", [
        { path: "email", message: "Invalid email" },
        { path: "address.postalCode", message: "Too small" },
      ])
    );

    expect(problem.fieldErrors).toEqual({
      email: "Enter a valid email address.",
      postalCode: "Enter your postal code.",
    });
    expect(problem.message).toBe("Please check the highlighted fields.");
    expect(problem.retryable).toBe(false);
  });

  it("says how many are left when stock ran short", () => {
    const problem = describeCheckoutError(
      error(409, "insufficient_stock", "Not enough", {
        items: [{ skuId: "golden-hour-serum", requested: 3, available: 1 }],
      }),
      { "golden-hour-serum": "Golden Hour Serum" }
    );

    expect(problem.message).toContain("Golden Hour Serum: only 1 left.");
    expect(problem.stockLimits).toEqual({ "golden-hour-serum": 1 });
    expect(problem.retryable).toBe(false);
  });

  it("says when something has just sold out", () => {
    const problem = describeCheckoutError(
      error(409, "insufficient_stock", "Not enough", {
        items: [{ skuId: "veil-spf", requested: 1, available: 0 }],
      }),
      { "veil-spf": "Veil SPF" }
    );
    expect(problem.message).toContain("Veil SPF has just sold out.");
    expect(problem.stockLimits).toEqual({ "veil-spf": 0 });
  });

  it("removes items the store no longer sells", () => {
    const problem = describeCheckoutError(
      error(422, "unknown_item", "Gone", { skuIds: ["old-product"] })
    );
    expect(problem.stockLimits).toEqual({ "old-product": 0 });
    expect(problem.message).toContain("no longer available");
  });

  it("asks to wait when rate limited", () => {
    const problem = describeCheckoutError(error(429, "fst_err_ctp_too_many_requests", "Slow down"));
    expect(problem.message).toContain("wait a minute");
    expect(problem.retryable).toBe(true);
  });

  it("passes on a clear message for other refusals, such as an expired hold", () => {
    const problem = describeCheckoutError(
      error(409, "reservation_expired", "Your items were held for too long.")
    );
    expect(problem.message).toBe("Your items were held for too long.");
    expect(problem.retryable).toBe(false);
  });

  it("keeps the same attempt when the connection dropped", () => {
    const problem = describeCheckoutError(
      new ApiError(0, "network_error", "Could not reach the store.")
    );
    expect(problem.message).toBe("Could not reach the store.");
    expect(problem.retryable).toBe(true);
  });

  it("keeps the same attempt after a server failure", () => {
    const problem = describeCheckoutError(error(500, "internal_error", "Boom"));
    expect(problem.retryable).toBe(true);
    expect(problem.message).toContain("our side");
  });

  it("copes with an error it has never seen", () => {
    const problem = describeCheckoutError(new Error("weird"));
    expect(problem.retryable).toBe(true);
    expect(problem.fieldErrors).toEqual({});
  });
});

describe("describeCheckoutError: when the store cannot be reached or answers badly", () => {
  const problem = (error: unknown) => describeCheckoutError(error, { "dawn-cleanse": "Dawn Cleanse" });

  it("says a timeout is safe to retry, because the same request key gives back the same order", () => {
    const result = problem(new ApiError(0, "timeout", "x"));
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/took too long/);
    expect(result.message).toMatch(/not be charged twice/);
    expect(result.refreshBag).toBe(false);
  });

  it("says the store is not answering, and that the bag is safe", () => {
    const result = problem(new ApiError(502, "unavailable", "x"));
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/not answering/);
    expect(result.message).toMatch(/bag is safe/);
  });

  it("asks for a wait when rate limited, by code or by status", () => {
    for (const error of [new ApiError(429, "rate_limited", "x"), new ApiError(429, "error", "x")]) {
      const result = problem(error);
      expect(result.message).toMatch(/Too many attempts/);
      expect(result.retryable).toBe(true);
    }
  });

  it("does not retry a key that was reused for a different order", () => {
    const result = problem(new ApiError(422, "idempotency_key_reused", "technical words"));
    expect(result.retryable).toBe(false);
    expect(result.message).not.toMatch(/key|idempotency|technical/i);
  });

  it("says an order was closed before it could be paid", () => {
    const result = problem(new ApiError(409, "order_closed", "This order can no longer be paid."));
    expect(result.retryable).toBe(false);
    expect(result.message).toMatch(/place it again/);
  });

  it("keeps the reason a stock hold ran out, in the store's own words", () => {
    const result = problem(new ApiError(409, "reservation_expired", "Your items were held for too long."));
    expect(result.message).toBe("Your items were held for too long.");
    expect(result.retryable).toBe(false);
  });

  it("names the limit per order when the bag is what the API objected to", () => {
    const result = problem(
      new ApiError(400, "validation_error", "x", [{ path: "items.0.quantity", message: "too big" }])
    );
    expect(result.message).toMatch(/at most 10/);
    expect(result.refreshBag).toBe(true);
    expect(result.retryable).toBe(false);
    expect(result.fieldErrors).toEqual({});
  });

  it("does not say fields are highlighted when none were", () => {
    const result = problem(new ApiError(400, "validation_error", "x", [{ path: "shippingId", message: "bad" }]));
    expect(result.message).not.toMatch(/highlighted/);
    expect(result.message).toMatch(/check your details/i);
  });

  it("copes with details that are missing or are not a list", () => {
    for (const details of [undefined, null, "text", 5, {}, [null]]) {
      expect(() => problem(new ApiError(400, "validation_error", "x", details))).not.toThrow();
    }
  });

  it("asks for the bag to be checked again when items sold out or vanished", () => {
    const stock = problem(
      new ApiError(409, "insufficient_stock", "x", { items: [{ skuId: "dawn-cleanse", requested: 3, available: 1 }] })
    );
    expect(stock.refreshBag).toBe(true);
    expect(stock.stockLimits).toEqual({ "dawn-cleanse": 1 });

    const gone = problem(new ApiError(422, "unknown_item", "x", { skuIds: ["dawn-cleanse"] }));
    expect(gone.refreshBag).toBe(true);
    expect(gone.stockLimits).toEqual({ "dawn-cleanse": 0 });
  });

  it("answers an unexpected failure with something safe to show, and allows a retry", () => {
    for (const error of [new Error("boom"), "text", null, undefined, new ApiError(500, "internal_error", "Something went wrong.")]) {
      const result = problem(error);
      expect(result.message).toMatch(/try again/i);
      expect(result.retryable).toBe(true);
      expect(result.message).not.toMatch(/boom|Error:/);
    }
  });
});
