import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.reset();
});
afterAll(() => ctx.close());

describe("GET /products", () => {
  it("lists the catalog in display order", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/products" });
    expect(res.statusCode).toBe(200);

    const { products } = res.json();
    expect(products.map((p: { id: string }) => p.id)).toEqual([
      "dawn-cleanse",
      "golden-hour-serum",
      "second-skin-cream",
      "veil-spf",
      "freyya-balm",
      "dew-drops",
    ]);
  });

  it("gives whole-dollar prices and a hero flag", async () => {
    const { products } = (await ctx.app.inject({ method: "GET", url: "/products" })).json();
    const serum = products.find((p: { id: string }) => p.id === "golden-hour-serum");
    expect(serum).toMatchObject({ price: 58, category: "Serum" });
    expect(products.filter((p: { isHero?: boolean }) => p.isHero)).toHaveLength(1);
  });

  it("puts stock on the product, or on each shade when there are shades", async () => {
    const { products } = (await ctx.app.inject({ method: "GET", url: "/products" })).json();

    const serum = products.find((p: { id: string }) => p.id === "golden-hour-serum");
    expect(serum.stock).toBe(3);
    expect(serum.variants).toBeUndefined();

    const balm = products.find((p: { id: string }) => p.id === "freyya-balm");
    expect(balm.stock).toBeUndefined();
    expect(balm.variants).toHaveLength(4);
    expect(balm.variants.find((v: { id: string }) => v.id === "terracotta")).toMatchObject({
      name: "Terracotta",
      stock: 2,
      undertone: "warm",
      intensity: "bold",
    });
  });

  it("keeps the details the product page shows", async () => {
    const { products } = (await ctx.app.inject({ method: "GET", url: "/products" })).json();
    const cream = products.find((p: { id: string }) => p.id === "second-skin-cream");
    expect(cream.details.ingredients).toEqual(expect.any(String));
    expect(cream.details.skinTypes.length).toBeGreaterThan(0);
    expect(cream.related.length).toBeGreaterThan(0);
  });
});

describe("GET /products/:id", () => {
  it("returns one product", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/products/dew-drops" });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.variants).toHaveLength(4);
  });

  it("returns 404 for one that does not exist", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/products/nothing" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});

describe("GET /config", () => {
  it("shares the shipping rules and countries", async () => {
    const { json } = await ctx.app.inject({ method: "GET", url: "/config" });
    const config = json();

    expect(config.freeShippingThreshold).toBe(75);
    expect(config.shippingMethods).toEqual([
      { id: "standard", label: "Standard", eta: "3–5 business days", price: 6, freeOver: 75 },
      { id: "express", label: "Express", eta: "1–2 business days", price: 14 },
    ]);
    expect(config.countries).toContain("Egypt");
  });
});

describe("GET /health", () => {
  it("reports the database is reachable", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("unknown routes", () => {
  it("answer in JSON", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});
