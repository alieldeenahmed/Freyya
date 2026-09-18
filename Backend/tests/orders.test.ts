import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inventoryMovements, orders, skus } from "../src/db/schema.js";
import { expireReservations } from "../src/services/orders.js";
import { createTestContext, validOrder, type TestContext } from "./helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());
beforeEach(() => ctx.reset());

const stockOf = async (skuId: string) =>
  (await ctx.db.select().from(skus).where(eq(skus.id, skuId)))[0]?.stock;

const place = (body: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({ method: "POST", url: "/orders", payload: body as object, headers });

const pay = (id: string, email = "sara@example.com") =>
  ctx.app.inject({ method: "POST", url: `/orders/${id}/pay`, payload: { email } });

describe("placing an order", () => {
  it("prices the order from the database and takes the stock", async () => {
    const res = await place(validOrder({ items: [{ skuId: "dawn-cleanse", quantity: 2 }] }));

    expect(res.statusCode).toBe(201);
    const { order } = res.json();
    expect(order.id).toMatch(/^FRY-/);
    expect(order.status).toBe("pending_payment");
    expect(order.totals).toEqual({ subtotal: 56, shipping: 6, total: 62 });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ id: "dawn-cleanse", name: "Dawn Cleanse", quantity: 2 });

    expect(await stockOf("dawn-cleanse")).toBe(22);
    const [movement] = await ctx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, order.id));
    expect(movement).toMatchObject({ delta: -2, stockAfter: 22, reason: "order" });
  });

  it("makes standard shipping free from $75", async () => {
    const res = await place(validOrder({ items: [{ skuId: "golden-hour-serum", quantity: 2 }] }));
    expect(res.json().order.totals).toEqual({ subtotal: 116, shipping: 0, total: 116 });
  });

  it("charges express shipping even on a big order", async () => {
    const res = await place(
      validOrder({ shippingId: "express", items: [{ skuId: "golden-hour-serum", quantity: 2 }] })
    );
    expect(res.json().order.totals.shipping).toBe(14);
  });

  it("orders a specific shade", async () => {
    const res = await place(validOrder({ items: [{ skuId: "freyya-balm:bare", quantity: 1 }] }));
    const [item] = res.json().order.items;
    expect(item).toMatchObject({
      id: "freyya-balm:bare",
      productId: "freyya-balm",
      variantId: "bare",
      variantName: "Bare",
    });
    expect(await stockOf("freyya-balm:bare")).toBe(17);
  });

  it("ignores a price sent by the client", async () => {
    const res = await place(
      validOrder({ items: [{ skuId: "golden-hour-serum", quantity: 1, price: 1 }], total: 1 })
    );
    expect(res.json().order.totals.subtotal).toBe(58);
  });

  it("merges the same item listed twice", async () => {
    const res = await place(
      validOrder({
        items: [
          { skuId: "dawn-cleanse", quantity: 1 },
          { skuId: "dawn-cleanse", quantity: 2 },
        ],
      })
    );
    const { items } = res.json().order;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(await stockOf("dawn-cleanse")).toBe(21);
  });

  it("refuses more than is in stock and changes nothing", async () => {
    const res = await place(
      validOrder({
        items: [
          { skuId: "dawn-cleanse", quantity: 1 },
          { skuId: "golden-hour-serum", quantity: 4 },
        ],
      })
    );

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("insufficient_stock");
    expect(res.json().error.details.items).toEqual([
      { skuId: "golden-hour-serum", requested: 4, available: 3 },
    ]);

    // Nothing was taken, not even the item that was available.
    expect(await stockOf("dawn-cleanse")).toBe(24);
    expect(await stockOf("golden-hour-serum")).toBe(3);
    expect(await ctx.db.select().from(orders)).toHaveLength(0);
  });

  it("refuses an item that does not exist", async () => {
    const res = await place(validOrder({ items: [{ skuId: "nothing-here", quantity: 1 }] }));
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("unknown_item");
  });

  it("refuses an item that has been switched off", async () => {
    await ctx.db.execute(sql`update products set active = false where id = 'veil-spf'`);
    const res = await place(validOrder({ items: [{ skuId: "veil-spf", quantity: 1 }] }));
    expect(res.statusCode).toBe(422);
  });

  it("rejects a bad request with the fields that are wrong", async () => {
    const res = await place(validOrder({ email: "nope", items: [] }));
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe("validation_error");
    expect(error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(["email", "items"])
    );
  });

  it("rejects an absurd quantity", async () => {
    const res = await place(validOrder({ items: [{ skuId: "dawn-cleanse", quantity: 500 }] }));
    expect(res.statusCode).toBe(400);
  });

  it("stores the email in lower case", async () => {
    const res = await place(validOrder({ email: "Sara@Example.COM" }));
    expect(res.json().order.email).toBe("sara@example.com");
  });
});

describe("retrying a checkout", () => {
  it("returns the same order for the same idempotency key and takes stock once", async () => {
    const headers = { "idempotency-key": "checkout-attempt-0001" };
    const first = await place(validOrder(), headers);
    const second = await place(validOrder(), headers);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().order.id).toBe(first.json().order.id);
    expect(await stockOf("dawn-cleanse")).toBe(23);
    expect(await ctx.db.select().from(orders)).toHaveLength(1);
  });

  it("creates only one order when the same request arrives twice at once", async () => {
    const headers = { "idempotency-key": "checkout-attempt-0002" };
    const results = await Promise.all([place(validOrder(), headers), place(validOrder(), headers)]);

    expect(new Set(results.map((r) => r.json().order.id)).size).toBe(1);
    expect(await stockOf("dawn-cleanse")).toBe(23);
  });

  it("makes separate orders for different keys", async () => {
    await place(validOrder(), { "idempotency-key": "checkout-attempt-0003" });
    await place(validOrder(), { "idempotency-key": "checkout-attempt-0004" });
    expect(await ctx.db.select().from(orders)).toHaveLength(2);
  });
});

describe("the last units", () => {
  it("never sells more than exists when many people order at once", async () => {
    // Golden Hour Serum has 3 left. Ten people each try to buy one.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        place(
          validOrder({
            email: `buyer${i}@example.com`,
            items: [{ skuId: "golden-hour-serum", quantity: 1 }],
          })
        )
      )
    );

    const statuses = results.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await stockOf("golden-hour-serum")).toBe(0);

    // The books balance: launch stock, minus three orders, equals what is left.
    const rows = await ctx.db
      .select({ delta: inventoryMovements.delta })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.skuId, "golden-hour-serum"));
    expect(rows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it("lets two people split what is left without overselling", async () => {
    // Terracotta has 2. One person takes 2, another asks for 1.
    const [a, b] = await Promise.all([
      place(validOrder({ items: [{ skuId: "freyya-balm:terracotta", quantity: 2 }] })),
      place(validOrder({ items: [{ skuId: "freyya-balm:terracotta", quantity: 1 }] })),
    ]);

    expect([a.statusCode, b.statusCode].filter((s) => s === 201)).toHaveLength(1);
    expect(await stockOf("freyya-balm:terracotta")).toBeGreaterThanOrEqual(0);
  });

  it("holds even when two orders want overlapping items in opposite order", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        place(
          validOrder({
            items:
              i % 2 === 0
                ? [
                    { skuId: "dawn-cleanse", quantity: 1 },
                    { skuId: "veil-spf", quantity: 1 },
                  ]
                : [
                    { skuId: "veil-spf", quantity: 1 },
                    { skuId: "dawn-cleanse", quantity: 1 },
                  ],
          })
        )
      )
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    expect(await stockOf("dawn-cleanse")).toBe(18);
    expect(await stockOf("veil-spf")).toBe(34);
  });
});

describe("paying", () => {
  it("marks the order paid and releases the hold", async () => {
    const { order } = (await place(validOrder())).json();
    const res = await pay(order.id);

    expect(res.statusCode).toBe(200);
    expect(res.json().order).toMatchObject({ status: "paid", reservedUntil: null });
    expect(res.json().order.paidAt).toEqual(expect.any(String));
  });

  it("accepts the email in any case", async () => {
    const { order } = (await place(validOrder())).json();
    expect((await pay(order.id, "SARA@example.com")).statusCode).toBe(200);
  });

  it("does not reveal whether an order exists", async () => {
    const { order } = (await place(validOrder())).json();
    const wrongEmail = await pay(order.id, "someone@else.com");
    const wrongId = await pay("FRY-NOTREAL", "sara@example.com");

    expect(wrongEmail.statusCode).toBe(404);
    expect(wrongId.statusCode).toBe(404);
    expect(wrongEmail.json()).toEqual(wrongId.json());
  });

  it("can be repeated safely", async () => {
    const { order } = (await place(validOrder())).json();
    await pay(order.id);
    const [before] = await ctx.db.select().from(orders);
    const again = await pay(order.id);

    expect(again.statusCode).toBe(200);
    const [after] = await ctx.db.select().from(orders);
    expect(after?.paymentRef).toBe(before?.paymentRef);
  });

  it("refuses a cancelled order", async () => {
    const { order } = (await place(validOrder())).json();
    await ctx.db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));

    const res = await pay(order.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("order_closed");
  });
});

describe("unpaid orders", () => {
  const expire = (id: string) =>
    ctx.db
      .update(orders)
      .set({ reservedUntil: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, id));

  it("give their stock back once the hold runs out", async () => {
    const { order } = (
      await place(validOrder({ items: [{ skuId: "dawn-cleanse", quantity: 3 }] }))
    ).json();
    expect(await stockOf("dawn-cleanse")).toBe(21);

    // Still held, so nothing is released yet.
    expect(await expireReservations(ctx.db)).toBe(0);

    await expire(order.id);
    expect(await expireReservations(ctx.db)).toBe(1);

    expect(await stockOf("dawn-cleanse")).toBe(24);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("cancelled");

    const movements = await ctx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, order.id));
    expect(movements.map((m) => m.reason).sort()).toEqual(["cancellation", "order"]);
  });

  it("are released only once", async () => {
    const { order } = (await place(validOrder())).json();
    await expire(order.id);

    expect(await expireReservations(ctx.db)).toBe(1);
    expect(await expireReservations(ctx.db)).toBe(0);
    expect(await stockOf("dawn-cleanse")).toBe(24);
  });

  it("cannot be paid after the hold ran out, and the stock is freed", async () => {
    const { order } = (await place(validOrder())).json();
    await expire(order.id);

    const res = await pay(order.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("reservation_expired");
    expect(await stockOf("dawn-cleanse")).toBe(24);

    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("cancelled");
  });

  it("leave paid orders alone", async () => {
    const { order } = (await place(validOrder())).json();
    await pay(order.id);
    await ctx.db
      .update(orders)
      .set({ reservedUntil: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, order.id));

    expect(await expireReservations(ctx.db)).toBe(0);
    expect(await stockOf("dawn-cleanse")).toBe(23);
  });
});

describe("looking an order up", () => {
  const lookup = (id: string, email: string) =>
    ctx.app.inject({ method: "GET", url: `/orders/${id}?email=${encodeURIComponent(email)}` });

  it("needs the order number and the email", async () => {
    const { order } = (await place(validOrder())).json();

    const ok = await lookup(order.id, "SARA@example.com");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().order.id).toBe(order.id);

    expect((await lookup(order.id, "other@example.com")).statusCode).toBe(404);
    expect((await lookup("FRY-NOTREAL", "sara@example.com")).statusCode).toBe(404);
  });

  it("asks for an email", async () => {
    const { order } = (await place(validOrder())).json();
    const res = await ctx.app.inject({ method: "GET", url: `/orders/${order.id}` });
    expect(res.statusCode).toBe(400);
  });
});
