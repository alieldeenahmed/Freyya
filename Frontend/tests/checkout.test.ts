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
