import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serializeRequest } from "../src/create-app.js";
import { loadConfig } from "../src/config.js";
import { adminSessions } from "../src/db/schema.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ORIGIN,
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

const login = (app = ctx.app, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url: "/admin/login", headers, payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });

// Every route the API has, and which of them may be used without signing in. Adding a route
// makes the test below fail until someone decides which list it belongs on.
const OPEN_ROUTES = [
  "GET /health",
  "GET /config",
  "GET /products",
  "GET /products/:id",
  "POST /orders",
  "GET /orders/:id",
  "POST /orders/:id/pay",
  "POST /admin/login",
  "POST /admin/logout",
  // Scheduled jobs. Open to sessions, but each one needs the shared CRON_SECRET (see serverless.test.ts).
  "GET /internal/sweep-reservations",
  "POST /internal/sweep-reservations",
  "POST /internal/demo-reset",
  // Answers the browser's preflight check. The CORS plugin owns it.
  "OPTIONS *",
];

describe("who can reach what", () => {
  it("leaves open only the routes that are meant to be open", () => {
    const all = ctx.app.routeTable.map((r) => `${r.method} ${r.url}`);
    const open = all.filter((route) => !route.split(" ")[1]!.startsWith("/admin") || OPEN_ROUTES.includes(route));

    expect(open.sort()).toEqual([...OPEN_ROUTES].sort());
  });

  it("asks every other admin route for a session, before it reads anything else", async () => {
    const protectedRoutes = ctx.app.routeTable.filter(
      (r) => r.url.startsWith("/admin") && !OPEN_ROUTES.includes(`${r.method} ${r.url}`)
    );
    expect(protectedRoutes.length).toBeGreaterThanOrEqual(7);

    for (const { method, url } of protectedRoutes) {
      const path = url.replace(/:\w+/g, "x");
      // No cookie, a made-up cookie, and a well-formed but unknown token, with a body that
      // would be a validation error if it were read first.
      for (const cookies of [undefined, { freyya_admin: "made-up" }, { freyya_admin: "A".repeat(43) }]) {
        const res = await ctx.app.inject({
          method: method as "GET",
          url: path,
          ...(cookies && { cookies }),
          payload: method === "GET" ? undefined : { nonsense: true },
        });
        expect(res.statusCode, `${method} ${url}`).toBe(401);
        expect(res.json().error.code).toBe("unauthorized");
      }
    }
  });

  it("asks every scheduled job for the secret, before it does anything", async () => {
    const jobs = ctx.app.routeTable.filter((r) => r.url.startsWith("/internal"));
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    for (const { method, url } of jobs) {
      for (const headers of [{}, { authorization: "Bearer nope-nope-nope-nope-nope" }]) {
        const res = await ctx.app.inject({ method: method as "GET", url, headers });
        // With no CRON_SECRET configured the job is off (503); with one, a wrong secret is a 401.
        expect([401, 503], `${method} ${url}`).toContain(res.statusCode);
      }
    }
  });

  it("gives an unauthenticated visitor no data in the refusal", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/admin/orders" });
    expect(res.json()).toEqual({ error: { code: "unauthorized", message: "Sign in to continue." } });
  });
});

describe("the session cookie", () => {
  const setCookie = (res: Awaited<ReturnType<typeof login>>) => String(res.headers["set-cookie"]);

  it("is HttpOnly, SameSite=Lax, site-wide and expires with the session", async () => {
    const cookie = setCookie(await login());

    expect(cookie).toMatch(/^freyya_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it("is not marked Secure while developing over http", async () => {
    expect(setCookie(await login())).not.toMatch(/;\s*Secure/i);
  });

  it("is marked Secure in production", async () => {
    const production = await createTestContext({ NODE_ENV: "production" });
    try {
      expect(setCookie(await login(production.app))).toMatch(/;\s*Secure/i);
    } finally {
      await production.close();
    }
  });

  it("is a random token that the database only holds a hash of", async () => {
    const res = await login();
    const token = res.cookies.find((c) => c.name === "freyya_admin")!.value;

    expect(token.length).toBeGreaterThanOrEqual(43);
    const rows = await ctx.db.select().from(adminSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.id).not.toBe(token);
    // Knowing what is stored is not enough to sign in.
    const forged = await ctx.app.inject({ method: "GET", url: "/admin/me", cookies: { freyya_admin: rows[0]!.id } });
    expect(forged.statusCode).toBe(401);
  });

  it("differs from one sign-in to the next", async () => {
    const a = (await login()).cookies.find((c) => c.name === "freyya_admin")!.value;
    const b = (await login()).cookies.find((c) => c.name === "freyya_admin")!.value;
    expect(a).not.toBe(b);
  });

  it("is cleared when signing out, and the session is deleted on the server", async () => {
    const res = await login();
    const cookies = { freyya_admin: res.cookies.find((c) => c.name === "freyya_admin")!.value };

    const out = await ctx.app.inject({ method: "POST", url: "/admin/logout", cookies });

    expect(String(out.headers["set-cookie"])).toMatch(/freyya_admin=;/);
    expect(String(out.headers["set-cookie"])).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    expect(await ctx.db.select().from(adminSessions).where(eq(adminSessions.email, ADMIN_EMAIL))).toHaveLength(0);
  });

  it("does not exist after a failed sign-in", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: ADMIN_EMAIL, password: "wrong" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(await ctx.db.select().from(adminSessions)).toHaveLength(0);
  });
});

describe("requests from other websites", () => {
  it("cannot sign in from an unknown origin", async () => {
    const res = await login(ctx.app, { origin: "https://evil.example" });
    expect(res.statusCode).toBe(403);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("cannot change anything from an unknown origin, even with a real session", async () => {
    const cookies = { freyya_admin: (await login()).cookies.find((c) => c.name === "freyya_admin")!.value };

    for (const [method, url, payload] of [
      ["PATCH", "/admin/orders/FRY-X/status", { status: "cancelled" }],
      ["POST", "/admin/inventory/dawn-cleanse/adjust", { delta: 5, reason: "restock" }],
      ["POST", "/admin/logout", {}],
    ] as const) {
      const res = await ctx.app.inject({ method, url, cookies, payload, headers: { origin: "https://evil.example" } });
      expect(res.statusCode, url).toBe(403);
      expect(res.json().error.code).toBe("forbidden_origin");
    }
  });

  it("answers a preflight from the storefront, and not from anyone else", async () => {
    const preflight = (origin: string) =>
      ctx.app.inject({
        method: "OPTIONS",
        url: "/admin/orders",
        headers: { origin, "access-control-request-method": "PATCH" },
      });

    const ok = await preflight(ORIGIN);
    expect(ok.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(ok.headers["access-control-allow-credentials"]).toBe("true");

    const other = await preflight("https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("what sign-in accepts", () => {
  it.each([
    [{}],
    [{ email: ADMIN_EMAIL }],
    [{ email: {}, password: [] }],
    [{ email: ADMIN_EMAIL, password: 12345 }],
    [{ email: "not an email", password: "x" }],
    [{ email: ADMIN_EMAIL, password: "" }],
    [{ email: ADMIN_EMAIL, password: "p".repeat(201) }],
    [null],
  ])("answers 400, not 500, to %j", async (body) => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(body),
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("slows a guesser down with a limit on attempts, and says how long to wait", async () => {
    const limited = await createTestContext({}, { rateLimit: true });
    await limited.reset();
    try {
      const attempt = () =>
        limited.app.inject({ method: "POST", url: "/admin/login", payload: { email: ADMIN_EMAIL, password: "nope" } });

      const results = [];
      for (let i = 0; i < 7; i++) results.push(await attempt());

      expect(results.slice(0, 5).every((r) => r.statusCode === 401)).toBe(true);
      const blocked = results[5]!;
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe("rate_limited");
      expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);

      // Even the right password waits its turn once the limit is hit.
      const right = await limited.app.inject({ method: "POST", url: "/admin/login", payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
      expect(right.statusCode).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe("what other people's orders and admin data are protected by", () => {
  it("is never stored by a browser or a proxy", async () => {
    const cookies = { freyya_admin: (await login()).cookies.find((c) => c.name === "freyya_admin")!.value };
    const order = (await ctx.app.inject({ method: "POST", url: "/orders", payload: validOrder() })).json().order;

    const responses = [
      await ctx.app.inject({ method: "GET", url: "/admin/orders", cookies }),
      await ctx.app.inject({ method: "GET", url: "/admin/stats", cookies }),
      await ctx.app.inject({ method: "GET", url: "/admin/me", cookies }),
      await ctx.app.inject({ method: "GET", url: "/admin/orders" }),
      await ctx.app.inject({ method: "GET", url: `/orders/${order.id}?email=sara@example.com` }),
      await ctx.app.inject({ method: "GET", url: `/orders/${order.id}?email=wrong@example.com` }),
      await ctx.app.inject({ method: "POST", url: "/orders", payload: validOrder() }),
      await ctx.app.inject({ method: "POST", url: `/orders/${order.id}/pay`, payload: { email: "sara@example.com" } }),
    ];
    for (const res of responses) expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("gives a customer only what a customer needs to see", async () => {
    const created = (await ctx.app.inject({ method: "POST", url: "/orders", payload: validOrder(), headers: { "idempotency-key": "leak-check-0001" } })).json().order;
    await ctx.app.inject({ method: "POST", url: `/orders/${created.id}/pay`, payload: { email: "sara@example.com" } });

    const res = await ctx.app.inject({ method: "GET", url: `/orders/${created.id}?email=sara@example.com` });
    const text = res.body;

    expect(Object.keys(res.json().order).sort()).toEqual(
      [
        "address", "cancelledAt", "currency", "deliveredAt", "email", "id", "items", "name",
        "paidAt", "placedAt", "reservedUntil", "shippedAt", "shippingId", "status", "totals",
      ].sort()
    );
    for (const secret of ["leak-check-0001", "simulated", "paymentRef", "payment_ref", "idempotency", "fingerprint"]) {
      expect(text.toLowerCase()).not.toContain(secret.toLowerCase());
    }
  });

  it("does not tell a stranger whether an order exists", async () => {
    const order = (await ctx.app.inject({ method: "POST", url: "/orders", payload: validOrder() })).json().order;
    const wrongEmail = await ctx.app.inject({ method: "GET", url: `/orders/${order.id}?email=stranger@example.com` });
    const noOrder = await ctx.app.inject({ method: "GET", url: "/orders/FRY-NOPE000?email=sara@example.com" });
    const noEmail = await ctx.app.inject({ method: "GET", url: `/orders/${order.id}` });

    expect(wrongEmail.statusCode).toBe(404);
    expect(noOrder.statusCode).toBe(404);
    expect(wrongEmail.body).toBe(noOrder.body);
    expect(noEmail.statusCode).toBe(400);
  });

  it("limits how fast order numbers can be tried", async () => {
    const limited = await createTestContext({}, { rateLimit: true });
    await limited.reset();
    try {
      const results = [];
      for (let i = 0; i < 32; i++) {
        results.push(await limited.app.inject({ method: "GET", url: "/orders/FRY-NOPE000?email=a@example.com" }));
      }
      expect(results.filter((r) => r.statusCode === 404)).toHaveLength(30);
      expect(results.filter((r) => r.statusCode === 429)).toHaveLength(2);
    } finally {
      await limited.close();
    }
  });

  it("keeps a customer's email out of the request log", () => {
    const logged = serializeRequest({ method: "GET", url: "/orders/FRY-ABC?email=sara%40example.com", ip: "1.2.3.4" });

    expect(logged).toEqual({ method: "GET", url: "/orders/FRY-ABC", remoteAddress: "1.2.3.4" });
    expect(JSON.stringify(logged)).not.toContain("sara");
  });
});

describe("what the public endpoints reveal about the server", () => {
  it("shares shipping rules and nothing from the environment", async () => {
    const config = (await ctx.app.inject({ method: "GET", url: "/config" })).json();
    expect(Object.keys(config).sort()).toEqual(
      ["countries", "currency", "demo", "freeShippingThreshold", "reservationMinutes", "shippingMethods"].sort()
    );

    const body = JSON.stringify([
      config,
      (await ctx.app.inject({ method: "GET", url: "/health" })).json(),
      (await ctx.app.inject({ method: "GET", url: "/products" })).json(),
    ]);
    for (const secret of [ADMIN_EMAIL, ctx.config.ADMIN_PASSWORD_HASH!, process.env.TEST_DATABASE_URL!]) {
      expect(body).not.toContain(secret);
    }
  });

  const NUL = String.fromCharCode(0);
  const hostileIds = [
    "%00",
    "a%00b",
    "%27%3B%20drop%20table%20orders%3B--",
    "..%2F..%2Fetc%2Fpasswd",
    "x".repeat(101),
    "%F0%9F%98%80",
    "%20",
  ];

  it.each(hostileIds)("treats the id %s in a public address as not found, not as a failure", async (id) => {
    for (const [method, url, payload] of [
      ["GET", `/products/${id}`, undefined],
      ["GET", `/orders/${id}?email=a@example.com`, undefined],
      ["POST", `/orders/${id}/pay`, { email: "a@example.com" }],
    ] as const) {
      const res = await ctx.app.inject({ method, url, ...(payload && { payload }) });
      expect([404, 414], `${method} ${url}`).toContain(res.statusCode);
      expect(res.body).not.toMatch(/postgres|select |stack|invalid byte/i);
    }
  });

  it.each(hostileIds)("treats the id %s in an admin address as not found, not as a failure", async (id) => {
    const cookies = { freyya_admin: (await login()).cookies.find((c) => c.name === "freyya_admin")!.value };
    for (const [method, url, payload] of [
      ["GET", `/admin/orders/${id}`, undefined],
      ["PATCH", `/admin/orders/${id}/status`, { status: "paid" }],
      ["GET", `/admin/inventory/${id}/movements`, undefined],
      ["POST", `/admin/inventory/${id}/adjust`, { delta: 1, reason: "restock" }],
    ] as const) {
      const res = await ctx.app.inject({ method, url, cookies, ...(payload && { payload }) });
      expect([404, 414], `${method} ${url}`).toContain(res.statusCode);
    }
  });

  it("refuses a NUL character in any text, which the database cannot store", async () => {
    const cookies = { freyya_admin: (await login()).cookies.find((c) => c.name === "freyya_admin")!.value };
    const post = (payload: object) => ctx.app.inject({ method: "POST", url: "/orders", payload });

    expect((await post(validOrder({ name: `Sara${NUL}Nasser` }))).statusCode).toBe(400);
    expect((await post(validOrder({ items: [{ skuId: `dawn${NUL}`, quantity: 1 }] }))).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "GET", url: "/admin/orders?search=a%00b", cookies })).statusCode).toBe(400);
    const note = await ctx.app.inject({
      method: "POST",
      url: "/admin/inventory/dawn-cleanse/adjust",
      cookies,
      payload: { delta: 1, reason: "restock", note: `a${NUL}b` },
    });
    expect(note.statusCode).toBe(400);
  });

  it("sets the usual protective headers", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("configuration mistakes", () => {
  it("are reported by name, without repeating the values", () => {
    const secret = "postgresql://user:hunter2@db.example/freyya";
    let message = "";
    try {
      loadConfig({ DATABASE_URL: secret, PORT: "not-a-number", ADMIN_EMAIL: "not-an-email", ADMIN_PASSWORD_HASH: "scrypt$topsecret$hash" });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("PORT");
    expect(message).toContain("ADMIN_EMAIL");
    for (const value of [secret, "hunter2", "topsecret", "not-a-number"]) expect(message).not.toContain(value);
  });

  it("leave admin sign-in switched off rather than open", async () => {
    const off = await createTestContext({ ADMIN_EMAIL: undefined, ADMIN_PASSWORD_HASH: undefined });
    try {
      const res = await off.app.inject({ method: "POST", url: "/admin/login", payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
      expect(res.statusCode).toBe(503);
      expect((await off.app.inject({ method: "GET", url: "/admin/me" })).statusCode).toBe(401);
    } finally {
      await off.close();
    }
  });
});
