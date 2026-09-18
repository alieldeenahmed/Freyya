import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminSessions, inventoryMovements, orders, skus } from "../src/db/schema.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createTestContext,
  validOrder,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());
beforeEach(() => ctx.reset());

const COOKIE = "freyya_admin";

async function signIn(): Promise<Record<string, string>> {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = res.cookies.find((c) => c.name === COOKIE)?.value;
  if (!token) throw new Error("No session cookie was set");
  return { [COOKIE]: token };
}

const asAdmin = async (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
  ctx.app.inject({ method, url, cookies: await signIn(), ...(payload && { payload }) });

async function orderFor(items = [{ skuId: "dawn-cleanse", quantity: 1 }], email = "sara@example.com") {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/orders",
    payload: validOrder({ items, email }),
  });
  return res.json().order as { id: string };
}

const stockOf = async (skuId: string) =>
  (await ctx.db.select().from(skus).where(eq(skus.id, skuId)))[0]?.stock;

describe("signing in", () => {
  it("opens a session with an http-only cookie", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().admin.email).toBe(ADMIN_EMAIL);

    const cookie = res.cookies.find((c) => c.name === COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    // Only a hash of the token is stored, never the token.
    const [session] = await ctx.db.select().from(adminSessions);
    expect(session?.id).not.toBe(cookie?.value);
  });

  it("accepts the email in any case", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
  });

  it("gives the same answer for a wrong email and a wrong password", async () => {
    const wrongPassword = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: ADMIN_EMAIL, password: "not the password" },
    });
    const wrongEmail = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: "someone@else.test", password: ADMIN_PASSWORD },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongEmail.statusCode).toBe(401);
    expect(wrongEmail.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.cookies).toHaveLength(0);
  });

  it("stops after a few failed attempts", async () => {
    const limited = await createTestContext({}, { rateLimit: true });
    try {
      const attempt = () =>
        limited.app.inject({
          method: "POST",
          url: "/admin/login",
          payload: { email: ADMIN_EMAIL, password: "wrong password" },
        });

      const codes: number[] = [];
      for (let i = 0; i < 7; i++) codes.push((await attempt()).statusCode);

      expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
      expect(codes.slice(5)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });

  it("reports when admin sign-in has not been set up", async () => {
    const unconfigured = await createTestContext({ ADMIN_PASSWORD_HASH: undefined });
    try {
      const res = await unconfigured.app.inject({
        method: "POST",
        url: "/admin/login",
        payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      expect(res.statusCode).toBe(503);
    } finally {
      await unconfigured.close();
    }
  });

  it("refuses a sign-in from an unknown origin", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { origin: "https://evil.example" },
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("sessions", () => {
  it("are required for every admin route", async () => {
    for (const [method, url] of [
      ["GET", "/admin/me"],
      ["GET", "/admin/stats"],
      ["GET", "/admin/orders"],
      ["GET", "/admin/inventory"],
    ] as const) {
      const res = await ctx.app.inject({ method, url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it("identify who is signed in", async () => {
    const res = await asAdmin("GET", "/admin/me");
    expect(res.statusCode).toBe(200);
    expect(res.json().admin.email).toBe(ADMIN_EMAIL);
  });

  it("end when the admin signs out", async () => {
    const cookies = await signIn();
    const out = await ctx.app.inject({ method: "POST", url: "/admin/logout", cookies });
    expect(out.statusCode).toBe(200);

    const after = await ctx.app.inject({ method: "GET", url: "/admin/me", cookies });
    expect(after.statusCode).toBe(401);
  });

  it("run out", async () => {
    const cookies = await signIn();
    await ctx.db.update(adminSessions).set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await ctx.app.inject({ method: "GET", url: "/admin/me", cookies });
    expect(res.statusCode).toBe(401);
  });

  it("are not accepted with a made-up cookie", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/admin/me",
      cookies: { [COOKIE]: "made-up-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("do not allow writes from an unknown origin", async () => {
    const order = await orderFor();
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/admin/orders/${order.id}/status`,
      cookies: await signIn(),
      headers: { origin: "https://evil.example" },
      payload: { status: "paid" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("orders", () => {
  it("lists newest first with a count of items", async () => {
    await orderFor([{ skuId: "dawn-cleanse", quantity: 2 }], "first@example.com");
    await orderFor([{ skuId: "veil-spf", quantity: 1 }], "second@example.com");

    const res = await asAdmin("GET", "/admin/orders");
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items.map((o: { email: string }) => o.email)).toEqual([
      "second@example.com",
      "first@example.com",
    ]);
    expect(body.items[1]).toMatchObject({ itemCount: 2, total: 62, status: "pending_payment" });
  });

  it("filters by status and searches by name, email or number", async () => {
    const a = await orderFor([{ skuId: "dawn-cleanse", quantity: 1 }], "alice@example.com");
    await orderFor([{ skuId: "veil-spf", quantity: 1 }], "bob@example.com");
    await asAdmin("PATCH", `/admin/orders/${a.id}/status`, { status: "paid" });

    expect((await asAdmin("GET", "/admin/orders?status=paid")).json().total).toBe(1);
    expect((await asAdmin("GET", "/admin/orders?search=bob")).json().items[0].email).toBe(
      "bob@example.com"
    );
    expect((await asAdmin("GET", `/admin/orders?search=${a.id.toLowerCase()}`)).json().total).toBe(1);
  });

  it("treats search characters literally", async () => {
    await orderFor();
    expect((await asAdmin("GET", "/admin/orders?search=%25")).json().total).toBe(0);
  });

  it("pages the list", async () => {
    for (let i = 0; i < 3; i++) await orderFor(undefined, `p${i}@example.com`);
    const res = await asAdmin("GET", "/admin/orders?pageSize=2&page=2");
    expect(res.json()).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(res.json().items).toHaveLength(1);
  });

  it("shows one order with what can happen next", async () => {
    const order = await orderFor();
    const res = await asAdmin("GET", `/admin/orders/${order.id}`);
    expect(res.json().order).toMatchObject({
      id: order.id,
      nextStatuses: ["paid", "cancelled"],
    });
  });

  it("moves an order along the normal path", async () => {
    const order = await orderFor();

    const paid = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "paid" });
    expect(paid.json().order).toMatchObject({ status: "paid", nextStatuses: ["shipped", "cancelled"] });
    expect(paid.json().order.paidAt).toEqual(expect.any(String));

    const shipped = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "shipped" });
    expect(shipped.json().order.shippedAt).toEqual(expect.any(String));

    const delivered = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, {
      status: "delivered",
    });
    expect(delivered.json().order.deliveredAt).toEqual(expect.any(String));
  });

  it("refuses a step that is not allowed", async () => {
    const order = await orderFor();
    const res = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "shipped" });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: "invalid_transition",
      details: { from: "pending_payment", to: "shipped" },
    });
  });

  it("returns the stock when an order is cancelled", async () => {
    const order = await orderFor([{ skuId: "dawn-cleanse", quantity: 4 }]);
    expect(await stockOf("dawn-cleanse")).toBe(20);

    const res = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "cancelled" });
    expect(res.json().order.status).toBe("cancelled");
    expect(await stockOf("dawn-cleanse")).toBe(24);

    const movements = await ctx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, order.id));
    const cancellation = movements.find((m) => m.reason === "cancellation");
    expect(cancellation).toMatchObject({ delta: 4, actor: ADMIN_EMAIL });
  });

  it("cannot cancel twice, so stock is not returned twice", async () => {
    const order = await orderFor([{ skuId: "dawn-cleanse", quantity: 4 }]);
    await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "cancelled" });
    const again = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "cancelled" });

    expect(again.statusCode).toBe(409);
    expect(await stockOf("dawn-cleanse")).toBe(24);
  });

  it("does not return stock on a refund", async () => {
    const order = await orderFor([{ skuId: "dawn-cleanse", quantity: 2 }]);
    for (const status of ["paid", "shipped", "refunded"]) {
      await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status });
    }
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("refunded");
    expect(await stockOf("dawn-cleanse")).toBe(22);
  });

  it("returns 404 for an order that does not exist", async () => {
    expect((await asAdmin("GET", "/admin/orders/FRY-NOTREAL")).statusCode).toBe(404);
    expect(
      (await asAdmin("PATCH", "/admin/orders/FRY-NOTREAL/status", { status: "paid" })).statusCode
    ).toBe(404);
  });

  it("rejects a status that does not exist", async () => {
    const order = await orderFor();
    const res = await asAdmin("PATCH", `/admin/orders/${order.id}/status`, { status: "lost" });
    expect(res.statusCode).toBe(400);
  });
});

describe("inventory", () => {
  it("lists every item and flags the low ones", async () => {
    const res = await asAdmin("GET", "/admin/inventory");
    const { items } = res.json();

    expect(items).toHaveLength(12);
    const low = items.filter((i: { low: boolean }) => i.low).map((i: { skuId: string }) => i.skuId);
    expect(low).toEqual(
      expect.arrayContaining(["golden-hour-serum", "freyya-balm:terracotta", "freyya-balm:petal"])
    );
    expect(items.find((i: { skuId: string }) => i.skuId === "veil-spf").low).toBe(false);
  });

  it("adds stock and records who did it and why", async () => {
    const res = await asAdmin("POST", "/admin/inventory/golden-hour-serum/adjust", {
      delta: 20,
      reason: "restock",
      note: "Delivery from the lab",
    });

    expect(res.json()).toEqual({ skuId: "golden-hour-serum", stock: 23 });
    expect(await stockOf("golden-hour-serum")).toBe(23);

    const history = await asAdmin("GET", "/admin/inventory/golden-hour-serum/movements");
    expect(history.json().movements[0]).toMatchObject({
      delta: 20,
      stockAfter: 23,
      reason: "restock",
      note: "Delivery from the lab",
      actor: ADMIN_EMAIL,
    });
  });

  it("removes stock for a correction", async () => {
    const res = await asAdmin("POST", "/admin/inventory/dawn-cleanse/adjust", {
      delta: -4,
      reason: "adjustment",
      note: "Damaged in the warehouse",
    });
    expect(res.json().stock).toBe(20);
  });

  it("will not take stock below zero", async () => {
    const res = await asAdmin("POST", "/admin/inventory/golden-hour-serum/adjust", {
      delta: -4,
      reason: "adjustment",
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.details).toEqual({ available: 3 });
    expect(await stockOf("golden-hour-serum")).toBe(3);
  });

  it("rejects a change of nothing, or of the wrong kind", async () => {
    const zero = await asAdmin("POST", "/admin/inventory/dawn-cleanse/adjust", {
      delta: 0,
      reason: "restock",
    });
    const fraction = await asAdmin("POST", "/admin/inventory/dawn-cleanse/adjust", {
      delta: 1.5,
      reason: "restock",
    });
    const reason = await asAdmin("POST", "/admin/inventory/dawn-cleanse/adjust", {
      delta: 1,
      reason: "order",
    });
    expect([zero.statusCode, fraction.statusCode, reason.statusCode]).toEqual([400, 400, 400]);
  });

  it("returns 404 for an item that does not exist", async () => {
    const res = await asAdmin("POST", "/admin/inventory/nothing/adjust", {
      delta: 1,
      reason: "restock",
    });
    expect(res.statusCode).toBe(404);
  });

  it("keeps a history that adds up to the stock", async () => {
    await orderFor([{ skuId: "dawn-cleanse", quantity: 3 }]);
    await asAdmin("POST", "/admin/inventory/dawn-cleanse/adjust", { delta: 10, reason: "restock" });

    const { movements } = (
      await asAdmin("GET", "/admin/inventory/dawn-cleanse/movements")
    ).json();
    const sum = movements.reduce((total: number, m: { delta: number }) => total + m.delta, 0);
    expect(sum).toBe(await stockOf("dawn-cleanse"));
    expect(movements[0].reason).toBe("restock");
  });
});

describe("stats", () => {
  it("summarises orders, revenue and low stock", async () => {
    const a = await orderFor([{ skuId: "dawn-cleanse", quantity: 2 }]); // $62
    await orderFor([{ skuId: "veil-spf", quantity: 1 }]); // stays unpaid
    await asAdmin("PATCH", `/admin/orders/${a.id}/status`, { status: "paid" });

    const stats = (await asAdmin("GET", "/admin/stats")).json();
    expect(stats.ordersByStatus).toMatchObject({ pending_payment: 1, paid: 1, cancelled: 0 });
    expect(stats.revenue).toBe(62);
    expect(stats.ordersLast7Days).toBe(2);
    expect(stats.lowStockThreshold).toBe(5);
    expect(stats.lowStock.map((i: { skuId: string }) => i.skuId)).toContain("golden-hour-serum");
  });
});
