import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ORDER_STATUSES, orders, skus, type OrderStatus } from "../src/db/schema.js";
import { allowedNext, canTransition } from "../src/domain/order-status.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createTestContext,
  ledgerProblems,
  validOrder,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());
beforeEach(() => ctx.reset());

// The whole lifecycle, written out once. Everything below is checked against this table, so
// changing a rule means changing it here on purpose.
const EXPECTED: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const PAIRS = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));

async function signIn(): Promise<Record<string, string>> {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return { freyya_admin: res.cookies.find((c) => c.name === "freyya_admin")!.value };
}

const stockOf = async (skuId: string) =>
  (await ctx.db.select().from(skus).where(eq(skus.id, skuId)))[0]?.stock;

// An order forced into a given status, holding two units of stock as a real one would.
async function orderIn(status: OrderStatus) {
  const res = await ctx.app.inject({
    method: "POST",
    url: "/orders",
    payload: validOrder({ items: [{ skuId: "dawn-cleanse", quantity: 2 }] }),
  });
  const id = res.json().order.id as string;
  if (status === "cancelled") {
    // A cancelled order has already given its stock back.
    await ctx.db.update(skus).set({ stock: 24 }).where(eq(skus.id, "dawn-cleanse"));
    await ctx.db.execute(
      sql`delete from inventory_movements where order_id = ${id}`
    );
  }
  await ctx.db.update(orders).set({ status }).where(eq(orders.id, id));
  return id;
}

describe("the order lifecycle rules", () => {
  it("match the table, for every pair of statuses", () => {
    for (const [from, to] of PAIRS) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(EXPECTED[from].includes(to));
    }
    for (const status of ORDER_STATUSES) {
      expect(allowedNext(status), status).toEqual(EXPECTED[status]);
    }
  });

  it("never allow an order to stay where it is", () => {
    for (const status of ORDER_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it("only ever move forward: no status can be reached again from itself", () => {
    // Walk every path. If a status could be reached twice on one path, there is a loop.
    const walk = (status: OrderStatus, seen: OrderStatus[]) => {
      for (const next of allowedNext(status)) {
        expect(seen, `${[...seen, next].join(" -> ")}`).not.toContain(next);
        walk(next, [...seen, next]);
      }
    };
    walk("pending_payment", ["pending_payment"]);
  });

  it("end in cancelled or refunded, and nowhere else", () => {
    const finals = ORDER_STATUSES.filter((s) => allowedNext(s).length === 0);
    expect(finals.sort()).toEqual(["cancelled", "refunded"]);
  });
});

describe("changing an order's status through the admin API", () => {
  it.each(PAIRS.map(([from, to]) => [from, to, EXPECTED[from].includes(to)] as const))(
    "%s -> %s is %s",
    async (from, to, allowed) => {
      const id = await orderIn(from);
      const stockBefore = await stockOf("dawn-cleanse");

      const res = await ctx.app.inject({
        method: "PATCH",
        url: `/admin/orders/${id}/status`,
        cookies: await signIn(),
        payload: { status: to },
      });

      const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
      if (allowed) {
        expect(res.statusCode).toBe(200);
        expect(row?.status).toBe(to);
        // Only cancelling puts stock back. Paying, shipping, delivering and refunding leave it.
        expect(await stockOf("dawn-cleanse")).toBe(to === "cancelled" ? stockBefore! + 2 : stockBefore);
      } else {
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe("invalid_transition");
        expect(res.json().error.details.allowed).toEqual(EXPECTED[from]);
        expect(row?.status).toBe(from);
        expect(await stockOf("dawn-cleanse")).toBe(stockBefore);
      }
    }
  );

  it("records the time of each step, and only that step", async () => {
    const id = await orderIn("paid");
    const cookies = await signIn();
    await ctx.app.inject({ method: "PATCH", url: `/admin/orders/${id}/status`, cookies, payload: { status: "shipped" } });

    const [shipped] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    expect(shipped?.shippedAt).toBeInstanceOf(Date);
    expect(shipped?.deliveredAt).toBeNull();
    expect(shipped?.cancelledAt).toBeNull();

    await ctx.app.inject({ method: "PATCH", url: `/admin/orders/${id}/status`, cookies, payload: { status: "delivered" } });
    const [delivered] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    expect(delivered?.deliveredAt).toBeInstanceOf(Date);
  });

  it("keeps the stock ledger balanced through the whole lifecycle", async () => {
    const id = await orderIn("pending_payment");
    const cookies = await signIn();
    for (const status of ["paid", "shipped", "delivered", "refunded"]) {
      const res = await ctx.app.inject({ method: "PATCH", url: `/admin/orders/${id}/status`, cookies, payload: { status } });
      expect(res.statusCode, status).toBe(200);
    }
    expect(await ledgerProblems(ctx.db)).toEqual([]);
  });
});

describe("a customer or a forged request trying to change an order", () => {
  it("has no route for it: the status can only be changed from the admin", async () => {
    const id = await orderIn("pending_payment");

    for (const [method, url] of [
      ["PATCH", `/orders/${id}`],
      ["PATCH", `/orders/${id}/status`],
      ["PUT", `/orders/${id}`],
      ["DELETE", `/orders/${id}`],
      ["POST", `/orders/${id}/status`],
      ["POST", `/orders/${id}/cancel`],
      ["POST", `/orders/${id}/ship`],
    ] as const) {
      const res = await ctx.app.inject({ method, url, payload: { status: "shipped", email: "sara@example.com" } });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    expect(row?.status).toBe("pending_payment");
  });

  it("cannot skip payment by claiming it in the request", async () => {
    const id = await orderIn("pending_payment");

    const res = await ctx.app.inject({
      method: "POST",
      url: `/orders/${id}/pay`,
      payload: { email: "sara@example.com", status: "shipped", amountCents: 1, paymentRef: "free" },
    });

    expect(res.statusCode).toBe(200);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    expect(row?.status).toBe("paid");
    expect(row?.paymentRef).not.toBe("free");
  });

  it("is refused by the admin API without a session, whatever the status asked for", async () => {
    const id = await orderIn("pending_payment");
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/admin/orders/${id}/status`,
      payload: { status: "delivered" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.each([{}, { status: "shipped-ish" }, { status: 3 }, { status: null }, { status: ["paid"] }, { state: "paid" }])(
    "is refused for the request body %j",
    async (body) => {
      const id = await orderIn("pending_payment");
      const res = await ctx.app.inject({
        method: "PATCH",
        url: `/admin/orders/${id}/status`,
        cookies: await signIn(),
        payload: body,
      });
      expect(res.statusCode).toBe(400);
      const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
      expect(row?.status).toBe("pending_payment");
    }
  );

  it("ignores extra fields, so timestamps and payment references cannot be set from outside", async () => {
    const id = await orderIn("paid");
    await ctx.app.inject({
      method: "PATCH",
      url: `/admin/orders/${id}/status`,
      cookies: await signIn(),
      payload: { status: "shipped", shippedAt: "2001-01-01T00:00:00Z", paymentRef: "forged", totalCents: 1 },
    });

    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, id));
    expect(row?.status).toBe("shipped");
    expect(row?.shippedAt!.getFullYear()).toBeGreaterThan(2001);
    expect(row?.paymentRef).not.toBe("forged");
    expect(row?.totalCents).not.toBe(1);
  });

  it("gets a 404, not a status change, for an order that does not exist", async () => {
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/admin/orders/FRY-NOTREAL/status",
      cookies: await signIn(),
      payload: { status: "paid" },
    });
    expect(res.statusCode).toBe(404);
  });
});
