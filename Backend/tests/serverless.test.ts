import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/db/client.js";
import { DEMO_ORDERS, expectedDemoStock } from "../src/db/demo-seed.js";
import { adminSessions, appMeta, orders, rateLimits, skus } from "../src/db/schema.js";
import { sweepExpiredReservations } from "../src/services/reservations.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ORIGIN,
  createTestContext,
  ledgerProblems,
  setStock,
  validOrder,
  type TestContext,
} from "./helpers.js";

// What has to hold once the API runs as many short-lived instances instead of one process:
// holds expire without a timer, every instance agrees on the time, limits are shared, and the
// scheduled jobs and the demo reset are safe to call.

const CRON_SECRET = "cron-secret-for-tests-0123456789";
const PROXY_SECRET = "proxy-secret-for-tests-0123456789";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext({ CRON_SECRET });
});
afterAll(() => ctx.close());
beforeEach(() => ctx.reset());
afterEach(() => vi.useRealTimers());

const stockOf = async (skuId: string) =>
  (await ctx.db.select().from(skus).where(eq(skus.id, skuId)))[0]?.stock;

const place = (body: unknown = validOrder(), headers: Record<string, string> = {}, app = ctx.app) =>
  app.inject({ method: "POST", url: "/orders", payload: body as object, headers });

const pay = (id: string, app = ctx.app) =>
  app.inject({ method: "POST", url: `/orders/${id}/pay`, payload: { email: "sara@example.com" } });

const item = (skuId: string, quantity: number) => ({ skuId, quantity });

// Ends an unpaid order's hold, by the database clock.
const expire = (id: string) =>
  ctx.db.execute(sql`update orders set reserved_until = now() - interval '1 minute' where id = ${id}`);

const sweepNow = (secret = CRON_SECRET, method: "POST" | "GET" = "POST", app = ctx.app) =>
  app.inject({ method, url: "/internal/sweep-reservations", headers: { authorization: `Bearer ${secret}` } });

const expectLedger = async () => expect(await ledgerProblems(ctx.db)).toEqual([]);

describe("holds that run out, with no background process", () => {
  it("lets a new buyer have stock that an expired, unpaid order was holding, racing others for it", async () => {
    await setStock(ctx.db, "veil-spf", 2);
    const first = (await place(validOrder({ items: [item("veil-spf", 2)] }))).json().order;
    expect(await stockOf("veil-spf")).toBe(0);
    await expire(first.id);

    // Five buyers want the two units at once, and nothing has swept.
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        place(validOrder({ email: `buyer${i}@example.com`, items: [item("veil-spf", 2)] }))
      )
    );

    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(4);
    expect(await stockOf("veil-spf")).toBe(0);
    const [old] = await ctx.db.select().from(orders).where(eq(orders.id, first.id));
    expect(old?.status).toBe("cancelled");
    await expectLedger();
  });

  it("releases an expired hold once when the sweep runs twice at the same moment", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", 3)] }))).json();
    await expire(order.id);

    const [a, b] = await Promise.all([sweepNow(), sweepNow()]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().released + b.json().released).toBe(1);
    expect(await stockOf("dawn-cleanse")).toBe(before);
    await expectLedger();
    expect((await sweepNow()).json().released).toBe(0);
  });

  it("releases an expired hold once when the sweep and a payment arrive together", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place(validOrder({ items: [item("dawn-cleanse", 3)] }))).json();
    await expire(order.id);

    const [paid, swept] = await Promise.all([pay(order.id), sweepNow()]);

    // Whichever got there first, the order ends cancelled with its stock back exactly once.
    expect(paid.statusCode).toBe(409);
    expect(["reservation_expired", "order_closed"]).toContain(paid.json().error.code);
    expect(swept.statusCode).toBe(200);
    expect(await stockOf("dawn-cleanse")).toBe(before);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("cancelled");
    await expectLedger();
  });

  it("leaves an order alone while its payment is in flight, and the payment wins", async () => {
    const { order } = (await place()).json();
    // Not expired, so a sweep has nothing to do and the payment goes through.
    const [paid, swept] = await Promise.all([pay(order.id), sweepNow()]);

    expect(paid.statusCode).toBe(200);
    expect(swept.json().released).toBe(0);
    const [row] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.status).toBe("paid");
    await expectLedger();
  });

  it("never turns a buyer away because a sweep is releasing the very hold they need, however the two interleave", async () => {
    for (let round = 0; round < 6; round++) {
      await ctx.reset();
      await setStock(ctx.db, "veil-spf", 2);
      const held = (await place(validOrder({ items: [item("veil-spf", 2)] }))).json().order;
      await expire(held.id);

      const [fresh] = await Promise.all([place(validOrder({ items: [item("veil-spf", 2)] })), sweepNow()]);

      expect(fresh.statusCode, `round ${round}: ${fresh.body}`).toBe(201);
      expect(await stockOf("veil-spf")).toBe(0);
      await expectLedger();
    }
  });

  it("keeps the stock released by a buyer who was then refused for wanting too much", async () => {
    await setStock(ctx.db, "veil-spf", 2);
    const first = (await place(validOrder({ items: [item("veil-spf", 2)] }))).json().order;
    await expire(first.id);

    const tooMany = await place(validOrder({ items: [item("veil-spf", 5)] }));

    expect(tooMany.statusCode).toBe(409);
    // The refusal does not undo the release: the stock is back on the shelf.
    expect(await stockOf("veil-spf")).toBe(2);
    await expectLedger();
  });

  it("shows the right stock in the catalog the moment a hold ends, with no sweep", async () => {
    const before = await stockOf("golden-hour-serum");
    const { order } = (await place(validOrder({ items: [item("golden-hour-serum", 2)] }))).json();
    const during = await ctx.app.inject({ method: "GET", url: "/products/golden-hour-serum" });
    expect(during.json().product.stock).toBe(before! - 2);

    await expire(order.id);
    const after = await ctx.app.inject({ method: "GET", url: "/products" });

    const serum = after.json().products.find((p: { id: string }) => p.id === "golden-hour-serum");
    expect(serum.stock).toBe(before);
    await expectLedger();
  });

  it("releases many expired holds in batches, across items, without leaving any behind", async () => {
    const ids: string[] = [];
    for (const sku of ["dawn-cleanse", "veil-spf", "second-skin-cream"]) {
      for (let i = 0; i < 4; i++) {
        const res = await place(validOrder({ items: [item(sku, 1)] }));
        expect(res.statusCode, res.body).toBe(201);
        ids.push(res.json().order.id);
      }
    }
    await Promise.all(ids.map(expire));

    const released = await sweepExpiredReservations(ctx.db, { batchSize: 5 });

    expect(released).toBe(12);
    expect(await stockOf("dawn-cleanse")).toBe(24);
    await expectLedger();
  });
});

describe("time comes from the database, not from the process", () => {
  it("does not treat a hold as expired because this process thinks it is far in the future", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2045-01-01T00:00:00Z"));

    const { order } = (await place()).json();
    const paid = await pay(order.id);

    expect(paid.statusCode).toBe(200);
    expect(paid.json().order.status).toBe("paid");
  });

  it("still expires a hold that really has run out when this process thinks it is the past", async () => {
    const before = await stockOf("dawn-cleanse");
    const { order } = (await place()).json();
    await expire(order.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("1999-01-01T00:00:00Z"));
    const paid = await pay(order.id);

    expect(paid.statusCode).toBe(409);
    expect(paid.json().error.code).toBe("reservation_expired");
    expect(await stockOf("dawn-cleanse")).toBe(before);
  });

  it("sets the length of a hold by the database clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2045-01-01T00:00:00Z"));

    const { order } = (await place()).json();
    const [row] = await ctx.db.execute<{ minutes: number }>(
      sql`select round(extract(epoch from (reserved_until - now())) / 60)::int as minutes from orders where id = ${order.id}`
    ).then((r) => r.rows);

    expect(row?.minutes).toBe(15);
  });

  it("keeps an admin session valid by the database clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2045-01-01T00:00:00Z"));
    const login = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = login.cookies.find((c) => c.name === "freyya_admin")!.value;

    vi.setSystemTime(new Date("1990-01-01T00:00:00Z"));
    const me = await ctx.app.inject({ method: "GET", url: "/admin/me", cookies: { freyya_admin: token } });
    expect(me.statusCode).toBe(200);

    // And a session that has really ended stays ended, whatever this process thinks.
    await ctx.db.execute(sql`update admin_sessions set expires_at = now() - interval '1 minute'`);
    vi.setSystemTime(new Date("1990-01-01T00:00:00Z"));
    const after = await ctx.app.inject({ method: "GET", url: "/admin/me", cookies: { freyya_admin: token } });
    expect(after.statusCode).toBe(401);
  });
});

describe("the scheduled sweep", () => {
  it("needs the secret, in the Bearer form, and says nothing useful without it", async () => {
    for (const headers of [{}, { authorization: "Bearer wrong-secret-wrong-secret" }, { authorization: CRON_SECRET }, { authorization: `Basic ${CRON_SECRET}` }]) {
      const res = await ctx.app.inject({ method: "POST", url: "/internal/sweep-reservations", headers });
      expect(res.statusCode, JSON.stringify(headers)).toBe(401);
      expect(res.json()).toEqual({ error: { code: "unauthorized", message: "Not allowed." } });
    }
  });

  it("answers both POST and GET, since Vercel's own cron uses GET", async () => {
    expect((await sweepNow(CRON_SECRET, "POST")).statusCode).toBe(200);
    expect((await sweepNow(CRON_SECRET, "GET")).statusCode).toBe(200);
  });

  it("is switched off when no secret is configured, rather than open", async () => {
    const off = await createTestContext({ CRON_SECRET: undefined });
    try {
      const res = await sweepNow("anything-anything-anything", "POST", off.app);
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("jobs_not_configured");
    } finally {
      await off.close();
    }
  });

  it("is never stored, and does not change anything when nothing has expired", async () => {
    const before = await stockOf("dawn-cleanse");
    const res = await sweepNow();
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.json()).toEqual({ released: 0, clearedCounters: 0 });
    expect(await stockOf("dawn-cleanse")).toBe(before);
  });

  it("clears old counters and ended sessions", async () => {
    await ctx.db.insert(rateLimits).values({ key: "old", windowStart: sql`now() - interval '3 days'`, count: 4 });
    await ctx.db.insert(rateLimits).values({ key: "recent", count: 1 });
    await ctx.db.insert(adminSessions).values({ id: "ended", email: "a@b.c", expiresAt: sql`now() - interval '1 hour'` });

    const res = await sweepNow();

    expect(res.json().clearedCounters).toBe(1);
    expect((await ctx.db.select().from(rateLimits)).map((r) => r.key)).toEqual(["recent"]);
    expect(await ctx.db.select().from(adminSessions)).toHaveLength(0);
  });
});

describe("limits shared by every instance", () => {
  const attempt = (app: TestContext["app"], headers: Record<string, string> = {}) =>
    app.inject({
      method: "POST",
      url: "/admin/login",
      headers,
      payload: { email: ADMIN_EMAIL, password: "not-the-password" },
    });

  it("counts sign-in attempts from two separate instances against one limit", async () => {
    const a = await createTestContext({}, { rateLimit: true });
    const b = await createTestContext({}, { rateLimit: true });
    try {
      await a.reset();
      const results = [];
      for (const app of [a.app, b.app, a.app, b.app, a.app, b.app]) results.push(await attempt(app));

      expect(results.slice(0, 5).map((r) => r.statusCode)).toEqual([401, 401, 401, 401, 401]);
      expect(results[5]!.statusCode).toBe(429);
      expect(results[5]!.json().error.code).toBe("rate_limited");
      expect(Number(results[5]!.headers["retry-after"])).toBeGreaterThan(0);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it("counts requests that arrive at the same moment exactly", async () => {
    const a = await createTestContext({}, { rateLimit: true });
    try {
      await a.reset();
      const results = await Promise.all(Array.from({ length: 12 }, () => attempt(a.app)));
      expect(results.filter((r) => r.statusCode === 401)).toHaveLength(5);
      expect(results.filter((r) => r.statusCode === 429)).toHaveLength(7);
    } finally {
      await a.close();
    }
  });

  it("starts a new window once the old one is over, by the database clock", async () => {
    const a = await createTestContext({}, { rateLimit: true });
    try {
      await a.reset();
      for (let i = 0; i < 6; i++) await attempt(a.app);
      expect((await attempt(a.app)).statusCode).toBe(429);

      await a.db.update(rateLimits).set({ windowStart: sql`now() - interval '2 minutes'` });

      expect((await attempt(a.app)).statusCode).toBe(401);
    } finally {
      await a.close();
    }
  });
});

describe("which address a request is counted against", () => {
  const attempt = (app: TestContext["app"], headers: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: "/admin/login",
      headers,
      payload: { email: ADMIN_EMAIL, password: "not-the-password" },
    });
  const asVisitor = (ip: string, secret = PROXY_SECRET) => ({
    "x-freyya-proxy-secret": secret,
    "x-freyya-client-ip": ip,
  });

  it("counts each visitor separately when the storefront vouches for their address", async () => {
    const proxied = await createTestContext({ PROXY_SECRET }, { rateLimit: true });
    try {
      await proxied.reset();
      for (let i = 0; i < 6; i++) await attempt(proxied.app, asVisitor("203.0.113.7"));
      expect((await attempt(proxied.app, asVisitor("203.0.113.7"))).statusCode).toBe(429);

      // Someone else, arriving through the same storefront, is not locked out by that.
      expect((await attempt(proxied.app, asVisitor("203.0.113.8"))).statusCode).toBe(401);
      expect((await attempt(proxied.app, asVisitor("2001:db8::1"))).statusCode).toBe(401);
    } finally {
      await proxied.close();
    }
  });

  it("does not let anyone choose their own address without the secret", async () => {
    const proxied = await createTestContext({ PROXY_SECRET }, { rateLimit: true });
    try {
      await proxied.reset();
      // A wrong secret, no secret, and a made-up forwarded address are all counted by the
      // address the connection came from, so changing the claim does not dodge the limit.
      const guesses: Record<string, string>[] = [
        asVisitor("198.51.100.1", "a-wrong-secret-a-wrong-secret"),
        { "x-freyya-client-ip": "198.51.100.2" },
        { "x-forwarded-for": "198.51.100.3" },
        { ...asVisitor("198.51.100.4", "another-wrong-secret-here") },
        { "x-forwarded-for": "198.51.100.5, 198.51.100.6" },
        { "x-freyya-client-ip": "198.51.100.7" },
      ];
      const results = [];
      for (const headers of guesses) results.push((await attempt(proxied.app, headers)).statusCode);

      expect(results).toEqual([401, 401, 401, 401, 401, 429]);
    } finally {
      await proxied.close();
    }
  });

  it("ignores a vouched address that is not an address", async () => {
    const proxied = await createTestContext({ PROXY_SECRET }, { rateLimit: true });
    try {
      await proxied.reset();
      for (const claimed of ["not an ip", "", "1.2.3.4, 5.6.7.8", "999.1.1.1", "javascript:alert(1)", "a".repeat(300)]) {
        await attempt(proxied.app, asVisitor(claimed));
      }
      // All six were counted against the connection's own address.
      const keys = (await proxied.db.select().from(rateLimits)).map((row) => row.key);
      expect(keys).toEqual(["admin-login:127.0.0.1"]);
    } finally {
      await proxied.close();
    }
  });

  it("falls back to the connection's address when no secret is configured at all", async () => {
    const plain = await createTestContext({}, { rateLimit: true });
    try {
      await plain.reset();
      for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4", "198.51.100.5", "198.51.100.6"]) {
        await attempt(plain.app, asVisitor(ip));
      }
      expect((await plain.db.select().from(rateLimits)).map((r) => r.key)).toEqual(["admin-login:127.0.0.1"]);
    } finally {
      await plain.close();
    }
  });
});

describe("which origin may change things", () => {
  const FRONTEND = "https://freyya.vercel.app";
  let prod: TestContext;

  beforeAll(async () => {
    prod = await createTestContext({ CORS_ORIGINS: FRONTEND });
  });
  afterAll(() => prod.close());

  const loginFrom = (origin: string | undefined) =>
    prod.app.inject({
      method: "POST",
      url: "/admin/login",
      headers: origin === undefined ? {} : { origin },
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

  it("accepts exactly the deployed storefront", async () => {
    expect((await loginFrom(FRONTEND)).statusCode).toBe(200);
  });

  it.each([
    "https://freyya.vercel.app.evil.example",
    "https://evil.example/https://freyya.vercel.app",
    "http://freyya.vercel.app",
    "https://freyya.vercel.app/",
    "https://FREYYA.vercel.app",
    "https://freyya.vercel.app:8443",
    "https://freyya-git-deploy-vercel.vercel.app",
    "null",
    "https://freyya.vercel.app@evil.example",
  ])("refuses %s", async (origin) => {
    const res = await loginFrom(origin);
    expect(res.statusCode, origin).toBe(403);
    expect(res.json().error.code).toBe("forbidden_origin");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("marks the session cookie Secure, HttpOnly and SameSite=Lax in production", async () => {
    const production = await createTestContext({ CORS_ORIGINS: FRONTEND, NODE_ENV: "production" });
    try {
      const res = await production.app.inject({
        method: "POST",
        url: "/admin/login",
        headers: { origin: FRONTEND },
        payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      const cookie = String(res.headers["set-cookie"]);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Domain=/i);
    } finally {
      await production.close();
    }
  });
});

describe("the public demo", () => {
  it("refuses more unpaid orders than the cap, with a specific error", async () => {
    const demo = await createTestContext({ DEMO_MODE: true, DEMO_MAX_PENDING_ORDERS: 2 });
    try {
      await demo.reset();
      const first = await place(validOrder({ items: [item("dawn-cleanse", 1)] }), {}, demo.app);
      const second = await place(validOrder({ items: [item("veil-spf", 1)] }), {}, demo.app);
      const third = await place(validOrder({ items: [item("second-skin-cream", 1)] }), {}, demo.app);

      expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
      expect(third.statusCode).toBe(429);
      expect(third.json().error.code).toBe("demo_capacity");
      expect(third.json().error.message).toMatch(/busy/);

      // Paying one frees a place.
      await pay(first.json().order.id, demo.app);
      expect((await place(validOrder({ items: [item("second-skin-cream", 1)] }), {}, demo.app)).statusCode).toBe(201);
    } finally {
      await demo.close();
    }
  });

  it("holds the cap exactly when many orders arrive at the same moment", async () => {
    const demo = await createTestContext({ DEMO_MODE: true, DEMO_MAX_PENDING_ORDERS: 3 });
    try {
      await demo.reset();
      const skusToBuy = ["dawn-cleanse", "veil-spf", "second-skin-cream", "freyya-balm:bare", "dew-drops:bronze", "golden-hour-serum", "freyya-balm:petal", "dew-drops:moonlight"];
      const results = await Promise.all(
        skusToBuy.map((sku) => place(validOrder({ items: [item(sku, 1)] }), {}, demo.app))
      );

      expect(results.map((r) => r.statusCode + ":" + (r.json().error?.code ?? "ok")).sort()).toEqual(
        ["201:ok", "201:ok", "201:ok", ...Array(5).fill("429:demo_capacity")].sort()
      );
      expect((await demo.db.select().from(orders)).filter((o) => o.status === "pending_payment")).toHaveLength(3);
      expect(await ledgerProblems(demo.db)).toEqual([]);
    } finally {
      await demo.close();
    }
  });

  it("does not count a hold that has already run out against the cap", async () => {
    const demo = await createTestContext({ DEMO_MODE: true, DEMO_MAX_PENDING_ORDERS: 1 });
    try {
      await demo.reset();
      const first = (await place(validOrder({ items: [item("dawn-cleanse", 1)] }), {}, demo.app)).json().order;
      await demo.db.execute(sql`update orders set reserved_until = now() - interval '1 minute' where id = ${first.id}`);

      const next = await place(validOrder({ items: [item("dawn-cleanse", 1)] }), {}, demo.app);
      expect(next.statusCode).toBe(201);
    } finally {
      await demo.close();
    }
  });

  it("limits how many orders one address can place in an hour", async () => {
    const demo = await createTestContext({ DEMO_MODE: true, DEMO_ORDERS_PER_IP_PER_HOUR: 3, DEMO_MAX_PENDING_ORDERS: 50 }, { rateLimit: true });
    try {
      await demo.reset();
      const results = [];
      for (const sku of ["dawn-cleanse", "veil-spf", "second-skin-cream", "freyya-balm:bare"]) {
        results.push(await place(validOrder({ items: [item(sku, 1)] }), {}, demo.app));
      }
      expect(results.map((r) => r.statusCode)).toEqual([201, 201, 201, 429]);
      expect(results[3]!.json().error.code).toBe("rate_limited");
      expect(Number(results[3]!.headers["retry-after"])).toBeGreaterThan(60);
    } finally {
      await demo.close();
    }
  });

  it("is not limited like this when it is not the demo", async () => {
    const plain = await createTestContext({ DEMO_MAX_PENDING_ORDERS: 1 });
    try {
      await plain.reset();
      for (const sku of ["dawn-cleanse", "veil-spf", "second-skin-cream"]) {
        expect((await place(validOrder({ items: [item(sku, 1)] }), {}, plain.app)).statusCode).toBe(201);
      }
    } finally {
      await plain.close();
    }
  });

  it("says in /config whether it is the demo", async () => {
    const demo = await createTestContext({ DEMO_MODE: true });
    try {
      expect((await demo.app.inject({ method: "GET", url: "/config" })).json().demo).toBe(true);
      expect((await ctx.app.inject({ method: "GET", url: "/config" })).json().demo).toBe(false);
    } finally {
      await demo.close();
    }
  });
});

describe("the nightly demo reset", () => {
  let demo: TestContext;
  // null means no Authorization header at all.
  const reset = (secret: string | null = CRON_SECRET, app = demo.app) =>
    app.inject({
      method: "POST",
      url: "/internal/demo-reset",
      ...(secret !== null && { headers: { authorization: `Bearer ${secret}` } }),
    });
  const mark = () => demo.db.insert(appMeta).values({ key: "database_role", value: "demo" }).onConflictDoNothing();
  const unmark = () => demo.db.delete(appMeta).where(eq(appMeta.key, "database_role"));

  beforeAll(async () => {
    demo = await createTestContext({ DEMO_MODE: true, CRON_SECRET });
  });
  afterAll(async () => {
    await unmark();
    await demo.close();
  });
  beforeEach(async () => {
    await unmark();
    await demo.reset();
  });
  afterEach(() => unmark());

  it("refuses without the secret, and changes nothing", async () => {
    await mark();
    const { order } = (await place(validOrder(), {}, demo.app)).json();

    for (const secret of [null, "wrong-secret-wrong-secret"]) {
      expect((await reset(secret)).statusCode).toBe(401);
    }
    expect((await demo.db.select().from(orders)).map((o) => o.id)).toEqual([order.id]);
  });

  it("refuses when DEMO_MODE is off, even with the secret and the marker", async () => {
    const notDemo = await createTestContext({ CRON_SECRET });
    try {
      await mark();
      const { order } = (await place(validOrder(), {}, notDemo.app)).json();

      const res = await reset(CRON_SECRET, notDemo.app);

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("demo_only");
      expect((await notDemo.db.select().from(orders)).map((o) => o.id)).toEqual([order.id]);
    } finally {
      await unmark();
      await notDemo.close();
    }
  });

  it("refuses a database that does not carry the demo marker, even with the flag and the secret", async () => {
    const { order } = (await place(validOrder(), {}, demo.app)).json();

    const res = await reset();

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("not_demo_database");
    expect((await demo.db.select().from(orders)).map((o) => o.id)).toEqual([order.id]);
    expect(await ledgerProblems(demo.db)).toEqual([]);
  });

  it("is switched off when no secret is configured", async () => {
    const noSecret = await createTestContext({ DEMO_MODE: true, CRON_SECRET: undefined });
    try {
      await mark();
      expect((await reset("anything-anything-anything", noSecret.app)).statusCode).toBe(503);
    } finally {
      await unmark();
      await noSecret.close();
    }
  });

  it("puts back exactly the seed state, whatever happened before", async () => {
    await mark();
    // A day of use: orders in every state, stock moved by hand, a session, a counter, an item switched off.
    const paid = (await place(validOrder({ items: [item("dawn-cleanse", 4)] }), {}, demo.app)).json().order;
    await pay(paid.id, demo.app);
    await place(validOrder({ items: [item("golden-hour-serum", 3)] }), {}, demo.app);
    await setStock(demo.db, "veil-spf", 999);
    await demo.db.execute(sql`update products set active = false where id = 'second-skin-cream'`);
    await demo.app.inject({ method: "POST", url: "/admin/login", payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    await demo.db.insert(rateLimits).values({ key: "leftover", count: 9 });

    const res = await reset();

    expect(res.statusCode).toBe(200);
    expect(res.json().reset).toEqual({ orders: DEMO_ORDERS.length, items: 12 });

    // Stock is the launch stock less what the fake orders hold, and nothing else.
    const stock = Object.fromEntries((await demo.db.select().from(skus)).map((s) => [s.id, s.stock]));
    expect(stock).toEqual(expectedDemoStock());
    expect(await ledgerProblems(demo.db)).toEqual([]);

    // Only the fake orders remain, in their states, and nothing from the day.
    const rows = await demo.db.select().from(orders).orderBy(orders.id);
    expect(rows.map((o) => [o.id, o.status])).toEqual(DEMO_ORDERS.map((o) => [o.id, o.status]));
    expect(rows.every((o) => o.email.endsWith("@example.com"))).toBe(true);
    expect(await demo.db.select().from(adminSessions)).toHaveLength(0);
    expect(await demo.db.select().from(rateLimits)).toHaveLength(0);
    const active = await demo.db.execute(sql`select count(*)::int as n from products where active = false`);
    expect((active.rows[0] as { n: number }).n).toBe(0);

    // The marker survives, so it can be reset again, and doing so changes nothing.
    expect((await reset()).statusCode).toBe(200);
    expect(Object.fromEntries((await demo.db.select().from(skus)).map((s) => [s.id, s.stock]))).toEqual(expectedDemoStock());
    expect(await ledgerProblems(demo.db)).toEqual([]);
  });

  it("gives the admin real orders to look at, priced like any other", async () => {
    await mark();
    await reset();
    const cookies = {
      freyya_admin: (
        await demo.app.inject({ method: "POST", url: "/admin/login", payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
      ).cookies.find((c) => c.name === "freyya_admin")!.value,
    };

    const list = await demo.app.inject({ method: "GET", url: "/admin/orders", cookies });
    expect(list.json().total).toBe(DEMO_ORDERS.length);
    const detail = await demo.app.inject({ method: "GET", url: "/admin/orders/FRY-DEMO001", cookies });
    expect(detail.json().order.totals).toEqual({ subtotal: 64, shipping: 6, total: 70 });
    expect(detail.json().order.nextStatuses).toEqual(["shipped", "cancelled"]);
  });

  it("is safe when two resets run at the same moment", async () => {
    await mark();
    const results = await Promise.all([reset(), reset(), reset()]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    expect(await demo.db.select().from(orders)).toHaveLength(DEMO_ORDERS.length);
    expect(await ledgerProblems(demo.db)).toEqual([]);
  });
});

describe("keeping the tests away from the demo database", () => {
  const original = process.env.DEMO_DATABASE_HOST;
  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_DATABASE_HOST;
    else process.env.DEMO_DATABASE_HOST = original;
  });

  it("refuses to run against a database whose host is the demo's, pooled or direct", async () => {
    const host = new URL(process.env.TEST_DATABASE_URL!).hostname;
    for (const demoHost of [host, host.replace(/-pooler(?=\.)/, ""), host.replace(/^(ep-[a-z0-9-]+?)(-pooler)?\./, "$1-pooler.")]) {
      process.env.DEMO_DATABASE_HOST = demoHost;
      await expect(createTestContext()).rejects.toThrow(/demo database/);
    }
  });

  it("refuses to run against a database that carries the demo marker", async () => {
    await ctx.db.insert(appMeta).values({ key: "database_role", value: "demo" }).onConflictDoNothing();
    try {
      await expect(createTestContext()).rejects.toThrow(/marked as the demo database/);
    } finally {
      await ctx.db.delete(appMeta).where(eq(appMeta.key, "database_role"));
    }
    await expect(createTestContext().then((c) => c.close())).resolves.toBeUndefined();
  });

  it("runs normally when the demo host is somewhere else", async () => {
    process.env.DEMO_DATABASE_HOST = "ep-some-other-demo-db.c-5.eu-central-1.aws.neon.tech";
    await expect(createTestContext().then((c) => c.close())).resolves.toBeUndefined();
  });
});

describe("connections", () => {
  it("keep a small pool per instance and give idle connections back quickly", async () => {
    const { pool } = createDb(process.env.TEST_DATABASE_URL!);
    try {
      expect(pool.options.max).toBe(5);
      expect(pool.options.idleTimeoutMillis).toBe(10_000);
    } finally {
      await pool.end();
    }
  });

  it("work through the connection pooler: no request path uses session state", async () => {
    // The tests run on whatever TEST_DATABASE_URL is. On the developer's machine that is Neon's
    // pooler in transaction mode, and CI uses a plain Postgres. This test makes the rule explicit:
    // a transaction sees none of the session state a previous one set.
    await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
    });
    const [row] = await ctx.db.execute<{ lock_timeout: string }>(sql`show lock_timeout`).then((r) => r.rows);
    expect(row?.lock_timeout).toBe("0");
  });

  it("answers /health only when the database answers, and shows nothing about the setup", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(ORIGIN).toBeTruthy();
  });
});
