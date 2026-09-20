import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inventoryMovements, orders, products, skus } from "../src/db/schema.js";
import { expireReservations } from "../src/services/orders.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createTestContext,
  ledgerProblems,
  setStock,
  validOrder,
  type TestContext,
} from "./helpers.js";

// Races and retries. After every one of them the same rule must hold: stock is never negative
// and always equals the sum of its recorded movements, so nothing was created or lost.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());
beforeEach(() => ctx.reset());

const stockOf = async (skuId: string) =>
  (await ctx.db.select().from(skus).where(eq(skus.id, skuId)))[0]?.stock;

const orderCount = async () => (await ctx.db.select().from(orders)).length;

const place = (body: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({ method: "POST", url: "/orders", payload: body as object, headers });

const pay = (id: string, email = "sara@example.com") =>
  ctx.app.inject({ method: "POST", url: `/orders/${id}/pay`, payload: { email } });

async function signIn(): Promise<Record<string, string>> {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return { freyya_admin: res.cookies.find((c) => c.name === "freyya_admin")!.value };
}

const adjust = (cookies: Record<string, string>, skuId: string, delta: number) =>
  ctx.app.inject({
    method: "POST",
    url: `/admin/inventory/${skuId}/adjust`,
    cookies,
    payload: { delta, reason: "adjustment" },
  });

const setStatus = (cookies: Record<string, string>, id: string, status: string) =>
  ctx.app.inject({ method: "PATCH", url: `/admin/orders/${id}/status`, cookies, payload: { status } });

const expire = (id: string) =>
  ctx.db
    .update(orders)
    .set({ reservedUntil: new Date(Date.now() - 60_000) })
    .where(eq(orders.id, id));

const item = (skuId: string, quantity: number) => ({ skuId, quantity });

async function expectLedgerToBalance() {
  expect(await ledgerProblems(ctx.db)).toEqual([]);
}

describe("idempotency keys", () => {
  it("refuse to be reused for a different order, and change nothing", async () => {
    const key = "key-conflict-0001";
    const first = await place(validOrder(), { "idempotency-key": key });
    expect(first.statusCode).toBe(201);
    const veilBefore = await stockOf("veil-spf");

    const clash = await place(validOrder({ items: [item("veil-spf", 2)] }), { "idempotency-key": key });

    expect(clash.statusCode).toBe(422);
    expect(clash.json().error.code).toBe("idempotency_key_reused");
    expect(await orderCount()).toBe(1);
    expect(await stockOf("veil-spf")).toBe(veilBefore);
    await expectLedgerToBalance();
  });

  it("refuse a different address or shipping method as well", async () => {
    const key = "key-conflict-0002";
    await place(validOrder(), { "idempotency-key": key });

    const elsewhere = validOrder({
      address: { line1: "99 Other Road", city: "Alexandria", postalCode: "21500", country: "Egypt" },
    });
    expect((await place(elsewhere, { "idempotency-key": key })).statusCode).toBe(422);
    expect((await place(validOrder({ shippingId: "express" }), { "idempotency-key": key })).statusCode).toBe(422);
    expect((await place(validOrder({ email: "someone@else.com" }), { "idempotency-key": key })).statusCode).toBe(422);
    expect(await orderCount()).toBe(1);
  });

  it("treat the same order written differently as the same order", async () => {
    const key = "key-same-order-01";
    const first = await place(
      validOrder({ items: [item("dawn-cleanse", 1), item("veil-spf", 1), item("dawn-cleanse", 1)] }),
      { "idempotency-key": key }
    );
    // Same things bought, listed in another order with the repeated item merged, and the
    // email written in capitals: still one order.
    const second = await place(
      validOrder({ items: [item("veil-spf", 1), item("dawn-cleanse", 2)], email: "SARA@example.com" }),
      { "idempotency-key": key }
    );

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().order.id).toBe(first.json().order.id);
    expect(await orderCount()).toBe(1);
  });

  it("let only one of two different orders using one key through, when they arrive together", async () => {
    const key = "key-race-0000001";
    const [a, b] = await Promise.all([
      place(validOrder({ items: [item("dawn-cleanse", 1)] }), { "idempotency-key": key }),
      place(validOrder({ items: [item("veil-spf", 1)] }), { "idempotency-key": key }),
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 422]);
    expect(await orderCount()).toBe(1);
    await expectLedgerToBalance();
  });

  it("give one order to ten identical requests at once, and take the stock once", async () => {
    const key = "key-ten-at-once-1";
    const before = await stockOf("dawn-cleanse");

    const results = await Promise.all(
      Array.from({ length: 10 }, () => place(validOrder(), { "idempotency-key": key }))
    );

    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(9);
    expect(new Set(results.map((r) => r.json().order.id)).size).toBe(1);
    expect(await stockOf("dawn-cleanse")).toBe(before! - 1);
    await expectLedgerToBalance();
  });

  it.each(["short", "has spaces in it", "emoji-key-\u{1F600}-here", "x".repeat(101), "semi;colon-key-1"])(
    "reject a key that is not plain: %s",
    async (key) => {
      const res = await place(validOrder(), { "idempotency-key": key });
      expect(res.statusCode).toBe(400);
      expect(await orderCount()).toBe(0);
    }
  );

  it("still replay orders made before keys were fingerprinted", async () => {
    const key = "key-legacy-000001";
    const first = await place(validOrder(), { "idempotency-key": key });
    await ctx.db.update(orders).set({ idempotencyFingerprint: null }).where(eq(orders.idempotencyKey, key));

    const again = await place(validOrder({ items: [item("veil-spf", 1)] }), { "idempotency-key": key });

    expect(again.statusCode).toBe(200);
    expect(again.json().order.id).toBe(first.json().order.id);
  });

  it("return the paid order when a retry arrives after the payment went through", async () => {
    const key = "key-after-paying-1";
    const first = await place(validOrder(), { "idempotency-key": key });
    await pay(first.json().order.id);
    const stock = await stockOf("dawn-cleanse");

    // The shopper's connection dropped after the order was paid. Their retry gets the truth.
    const retry = await place(validOrder(), { "idempotency-key": key });

    expect(retry.statusCode).toBe(200);
    expect(retry.json().order).toMatchObject({ id: first.json().order.id, status: "paid" });
    expect((await pay(first.json().order.id)).statusCode).toBe(200);
    expect(await stockOf("dawn-cleanse")).toBe(stock);
    expect(await orderCount()).toBe(1);
  });

  it("return a cancelled order as cancelled, and do not take the stock again", async () => {
    const key = "key-after-cancel-1";
    const first = await place(validOrder(), { "idempotency-key": key });
    await setStatus(await signIn(), first.json().order.id, "cancelled");
    const stock = await stockOf("dawn-cleanse");

    const retry = await place(validOrder(), { "idempotency-key": key });

    expect(retry.statusCode).toBe(200);
    expect(retry.json().order.status).toBe("cancelled");
    expect(await stockOf("dawn-cleanse")).toBe(stock);
    expect((await pay(first.json().order.id)).statusCode).toBe(409);
    await expectLedgerToBalance();
  });
});

describe("holds that have run out", () => {
  it("do not keep a buyer from stock that was held for an order nobody paid", async () => {
    await setStock(ctx.db, "dawn-cleanse", 2);

    const first = await place(validOrder({ items: [item("dawn-cleanse", 2)] }));
    expect(first.statusCode).toBe(201);
    expect(await stockOf("dawn-cleanse")).toBe(0);

    // Held, so a second buyer has to wait.
    const early = await place(validOrder({ items: [item("dawn-cleanse", 2)] }));
    expect(early.statusCode).toBe(409);

    // The hold runs out. No sweep has run, and the next buyer must not be turned away anyway.
    await expire(first.json().order.id);
    const late = await place(validOrder({ items: [item("dawn-cleanse", 2)] }));

    expect(late.statusCode).toBe(201);
    expect(await stockOf("dawn-cleanse")).toBe(0);
    const [old] = await ctx.db.select().from(orders).where(eq(orders.id, first.json().order.id));
    expect(old?.status).toBe("cancelled");
    await expectLedgerToBalance();
  });

  it("leave a paid order's stock alone", async () => {
    await setStock(ctx.db, "dawn-cleanse", 2);
    const first = await place(validOrder({ items: [item("dawn-cleanse", 2)] }));
    await pay(first.json().order.id);
    // Even a stale hold time on a paid order must not release anything.
    await expire(first.json().order.id);

    const next = await place(validOrder({ items: [item("dawn-cleanse", 1)] }));

    expect(next.statusCode).toBe(409);
    expect(await stockOf("dawn-cleanse")).toBe(0);
  });

  it("are released once when a payment and the sweep arrive together", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", 3)] }))).json();
    await expire(order.id);

    const [paid] = await Promise.all([pay(order.id), expireReservations(ctx.db)]);

    expect(paid.statusCode).toBe(409);
    expect(["reservation_expired", "order_closed"]).toContain(paid.json().error.code);
    expect(await stockOf("dawn-cleanse")).toBe(before);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("cancelled");
    const returned = await ctx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, order.id));
    expect(returned.filter((m) => m.reason === "cancellation")).toHaveLength(1);
    await expectLedgerToBalance();
  });

  it("are released once when two sweeps run together", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", 3)] }))).json();
    await expire(order.id);

    const released = await Promise.all([expireReservations(ctx.db), expireReservations(ctx.db)]);

    expect(released.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await stockOf("dawn-cleanse")).toBe(before);
    await expectLedgerToBalance();
  });

  it("let a new order and the sweep run together without losing or duplicating stock", async () => {
    await setStock(ctx.db, "dawn-cleanse", 2);
    const first = await place(validOrder({ items: [item("dawn-cleanse", 2)] }));
    await expire(first.json().order.id);

    const [fresh] = await Promise.all([
      place(validOrder({ items: [item("dawn-cleanse", 2)] })),
      expireReservations(ctx.db),
    ]);

    expect(fresh.statusCode).toBe(201);
    expect(await stockOf("dawn-cleanse")).toBe(0);
    await expectLedgerToBalance();
  });
});

describe("stock changes while orders are being placed", () => {
  it("never goes negative when buyers and the admin change one item together", async () => {
    await setStock(ctx.db, "veil-spf", 5);
    const cookies = await signIn();

    const results = await Promise.all([
      ...Array.from({ length: 8 }, () => place(validOrder({ items: [item("veil-spf", 1)] }))),
      adjust(cookies, "veil-spf", -3),
      adjust(cookies, "veil-spf", 2),
      adjust(cookies, "veil-spf", -1),
    ]);

    const orders = results.slice(0, 8);
    const changes = [-3, 2, -1].map((delta, i) => ({ delta, res: results[8 + i]! }));
    for (const r of [...orders, ...changes.map((c) => c.res)]) {
      expect([200, 201, 409]).toContain(r.statusCode);
    }
    for (const r of results.filter((r) => r.statusCode === 409)) {
      expect(r.json().error.code).toBe("insufficient_stock");
    }

    const sold = orders.filter((r) => r.statusCode === 201).length;
    const applied = changes.filter((c) => c.res.statusCode === 200).reduce((sum, c) => sum + c.delta, 0);
    expect(await stockOf("veil-spf")).toBe(5 + applied - sold);
    expect(await stockOf("veil-spf")).toBeGreaterThanOrEqual(0);
    await expectLedgerToBalance();
  });

  it("lets exactly as many removals through as there is stock", async () => {
    await setStock(ctx.db, "veil-spf", 10);
    const cookies = await signIn();

    const results = await Promise.all(Array.from({ length: 20 }, () => adjust(cookies, "veil-spf", -1)));

    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(10);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(10);
    expect(await stockOf("veil-spf")).toBe(0);
    await expectLedgerToBalance();
  });

  it("will not remove what buyers have already taken", async () => {
    await setStock(ctx.db, "veil-spf", 3);
    await place(validOrder({ items: [item("veil-spf", 3)] }));

    const res = await adjust(await signIn(), "veil-spf", -1);

    expect(res.statusCode).toBe(409);
    expect(await stockOf("veil-spf")).toBe(0);
    await expectLedgerToBalance();
  });

  it("serves a buyer who was refused once the admin restocks", async () => {
    await setStock(ctx.db, "veil-spf", 0);
    expect((await place(validOrder({ items: [item("veil-spf", 2)] }))).statusCode).toBe(409);

    await adjust(await signIn(), "veil-spf", 2);

    expect((await place(validOrder({ items: [item("veil-spf", 2)] }))).statusCode).toBe(201);
    expect(await stockOf("veil-spf")).toBe(0);
    await expectLedgerToBalance();
  });

  it("keeps the books straight through a mixed rush of orders, payments and cancellations", async () => {
    await setStock(ctx.db, "dawn-cleanse", 12);
    await setStock(ctx.db, "veil-spf", 12);
    const cookies = await signIn();

    const made = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        place(validOrder({ items: [item("dawn-cleanse", 1), item("veil-spf", (i % 2) + 1)] }))
      )
    );
    const ids = made.filter((r) => r.statusCode === 201).map((r) => r.json().order.id as string);

    // Pay some, cancel some, and try to do both to others, all at once.
    await Promise.all(
      ids.flatMap((id, i) =>
        i % 3 === 0 ? [pay(id)] : i % 3 === 1 ? [setStatus(cookies, id, "cancelled")] : [pay(id), setStatus(cookies, id, "cancelled")]
      )
    );

    await expectLedgerToBalance();
    const rows = await ctx.db.select().from(orders);
    const held = rows.filter((o) => o.status !== "cancelled");
    const cancelled = rows.filter((o) => o.status === "cancelled");
    expect(held.length + cancelled.length).toBe(ids.length);
    // Stock taken equals what the orders still standing are holding.
    expect(await stockOf("dawn-cleanse")).toBe(12 - held.length);
  });
});

describe("cancelling, paying and shipping at once", () => {
  async function paidOrder(quantity = 2) {
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", quantity)] }))).json();
    await pay(order.id);
    return order.id as string;
  }

  it("cancels an order once when ten cancellations arrive together", async () => {
    const before = await stockOf("dawn-cleanse");
    const id = await paidOrder(2);
    const cookies = await signIn();

    const results = await Promise.all(Array.from({ length: 10 }, () => setStatus(cookies, id, "cancelled")));

    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(9);
    expect(await stockOf("dawn-cleanse")).toBe(before);
    await expectLedgerToBalance();
  });

  it("lets only one of shipping and cancelling win, and the stock agrees with the winner", async () => {
    const before = await stockOf("dawn-cleanse");
    const id = await paidOrder(2);
    const cookies = await signIn();

    const [ship, cancel] = await Promise.all([
      setStatus(cookies, id, "shipped"),
      setStatus(cookies, id, "cancelled"),
    ]);

    expect([ship.statusCode, cancel.statusCode].sort()).toEqual([200, 409]);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    if (ship.statusCode === 200) {
      expect(row?.status).toBe("shipped");
      expect(await stockOf("dawn-cleanse")).toBe(before! - 2);
    } else {
      expect(row?.status).toBe("cancelled");
      expect(await stockOf("dawn-cleanse")).toBe(before);
    }
    await expectLedgerToBalance();
  });

  it("moves an order along once when the same step is sent five times", async () => {
    const id = await paidOrder(1);
    const cookies = await signIn();

    const results = await Promise.all(Array.from({ length: 5 }, () => setStatus(cookies, id, "shipped")));

    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409).every((r) => r.json().error.code === "invalid_transition")).toBe(true);
  });

  it("ends a payment and a cancellation that arrive together cancelled, with the stock back once", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", 2)] }))).json();
    const cookies = await signIn();

    const [paid, cancelled] = await Promise.all([pay(order.id), setStatus(cookies, order.id, "cancelled")]);

    // Cancelling is allowed before and after payment, so the order always ends cancelled. The
    // payment either went through first (200) or arrived at an order already cancelled (409).
    expect(cancelled.statusCode).toBe(200);
    expect([200, 409]).toContain(paid.statusCode);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("cancelled");
    expect(await stockOf("dawn-cleanse")).toBe(before);
    const returned = await ctx.db.select().from(inventoryMovements).where(eq(inventoryMovements.orderId, order.id));
    expect(returned.filter((m) => m.reason === "cancellation")).toHaveLength(1);
    await expectLedgerToBalance();
  });
});

describe("quantities and items that are not what they should be", () => {
  const badQuantities: unknown[] = [0, -1, 1.5, "2", null, true, [], {}, 11, 1e9, Number.MAX_SAFE_INTEGER, -0.0001];

  it.each(badQuantities.map((q) => [JSON.stringify(q), q]))("refuses a quantity of %s", async (_label, quantity) => {
    const before = await stockOf("dawn-cleanse");

    const res = await place(validOrder({ items: [{ skuId: "dawn-cleanse", quantity }] }));

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
    expect(await orderCount()).toBe(0);
    expect(await stockOf("dawn-cleanse")).toBe(before);
  });

  it("refuses a quantity that JSON can't hold", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(validOrder()).replace('"quantity":1', '"quantity":1e999'),
    });
    expect(res.statusCode).toBe(400);
    expect(await orderCount()).toBe(0);
  });

  it("does not let one item on two lines get round the limit of ten", async () => {
    const res = await place(validOrder({ items: [item("dawn-cleanse", 10), item("dawn-cleanse", 1)] }));

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
    expect(await orderCount()).toBe(0);
  });

  it.each([
    ["no items", []],
    ["twenty-one lines", Array.from({ length: 21 }, (_, i) => item(`sku-${i}`, 1))],
    ["items that are not a list", "dawn-cleanse"],
    ["a line that is not an object", [7]],
    ["a line with no item", [{ quantity: 1 }]],
  ])("refuses %s", async (_label, items) => {
    const res = await place(validOrder({ items }));
    expect(res.statusCode).toBe(400);
    expect(await orderCount()).toBe(0);
  });

  it.each([null, [], "text", 5])("refuses a body of %j", async (body) => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(body),
    });
    expect(res.statusCode).toBe(400);
  });

  it("refuses a body that is not JSON, and one that is far too large", async () => {
    const broken = await ctx.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(broken.statusCode).toBe(400);

    const huge = await ctx.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(validOrder({ name: "x".repeat(2_000_000) })),
    });
    expect(huge.statusCode).toBe(413);
    expect(await orderCount()).toBe(0);
  });

  it.each(["'; drop table orders; --", "../../etc/passwd", "x".repeat(101), "DAWN-CLEANSE"])(
    "treats an item id of %j as an unknown item, not an error",
    async (skuId) => {
      const res = await place(validOrder({ items: [item(skuId, 1)] }));
      expect([400, 422]).toContain(res.statusCode);
      expect(await orderCount()).toBe(0);
    }
  );

  it("ignores prices, totals and states sent by the client", async () => {
    const res = await place({
      ...validOrder(),
      status: "paid",
      totals: { subtotal: 1, shipping: 0, total: 1 },
      paidAt: new Date().toISOString(),
      idempotencyKey: "smuggled",
      items: [{ skuId: "dawn-cleanse", quantity: 1, price: 0.01, unitPriceCents: 1 }],
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().order).toMatchObject({
      status: "pending_payment",
      totals: { subtotal: 28, shipping: 6, total: 34 },
      paidAt: null,
    });
    const [row] = await ctx.db.select().from(orders);
    expect(row?.idempotencyKey).toBeNull();
  });

  it("keeps the price an order was placed at, and charges new orders the current price", async () => {
    const first = (await place(validOrder())).json().order;
    await ctx.db.update(products).set({ priceCents: 3100 }).where(eq(products.id, "dawn-cleanse"));

    try {
      const second = (await place(validOrder())).json().order;
      expect(second.totals.subtotal).toBe(31);

      const reread = await ctx.app.inject({ method: "GET", url: `/orders/${first.id}?email=sara@example.com` });
      expect(reread.json().order.totals.subtotal).toBe(28);
      expect(reread.json().order.items[0].price).toBe(28);
    } finally {
      await ctx.db.update(products).set({ priceCents: 2800 }).where(eq(products.id, "dawn-cleanse"));
    }
  });

  it("never leaves stock or the ledger changed by any refused order", async () => {
    for (const items of [[item("dawn-cleanse", 999)], [item("nope", 1)], [item("dawn-cleanse", 0)]]) {
      await place(validOrder({ items }));
    }
    expect(await orderCount()).toBe(0);
    const rows = await ctx.db.execute(sql`select count(*)::int as n from inventory_movements where reason = 'order'`);
    expect((rows.rows[0] as { n: number }).n).toBe(0);
    await expectLedgerToBalance();
  });
});
