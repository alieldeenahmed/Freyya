import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import {
  DEFAULT_VIEW,
  applyView,
  groupOf,
  parseView,
  viewToQuery,
  type ShopView,
} from "@/lib/shop";

const names = (view: ShopView) => applyView(products, view).map((p) => p.name);
const params = (query: string) => new URLSearchParams(query);

describe("filtering", () => {
  it("shows everything by default, in catalog order", () => {
    expect(applyView(products, DEFAULT_VIEW)).toEqual(products);
  });

  it("splits skincare from color", () => {
    expect(names({ group: "skincare", sort: "featured" })).toEqual([
      "Dawn Cleanse",
      "Golden Hour Serum",
      "Second Skin Cream",
      "Veil SPF",
    ]);
    expect(names({ group: "color", sort: "featured" })).toEqual(["Freyya Balm", "Dew Drops"]);
  });

  it("puts every product in exactly one group", () => {
    const skincare = applyView(products, { group: "skincare", sort: "featured" });
    const color = applyView(products, { group: "color", sort: "featured" });
    expect(skincare.length + color.length).toBe(products.length);
    expect(products.every((p) => ["skincare", "color"].includes(groupOf(p)))).toBe(true);
  });
});

describe("sorting", () => {
  it("orders by price, lowest first", () => {
    const prices = applyView(products, { group: "all", sort: "price-asc" }).map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("orders by price, highest first", () => {
    const prices = applyView(products, { group: "all", sort: "price-desc" }).map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("orders by name", () => {
    expect(names({ group: "all", sort: "name" })[0]).toBe("Dawn Cleanse");
  });

  it("sorts within the chosen group", () => {
    expect(names({ group: "color", sort: "price-desc" })).toEqual(["Dew Drops", "Freyya Balm"]);
  });

  it("does not reorder the catalog it is given", () => {
    const before = products.map((p) => p.id);
    applyView(products, { group: "all", sort: "price-desc" });
    expect(products.map((p) => p.id)).toEqual(before);
  });
});

describe("the URL", () => {
  it("reads a valid choice", () => {
    expect(parseView(params("?group=color&sort=name"))).toEqual({ group: "color", sort: "name" });
  });

  it("falls back to the default for missing or unknown values", () => {
    expect(parseView(params(""))).toEqual(DEFAULT_VIEW);
    expect(parseView(params("?group=hair&sort=cheapest"))).toEqual(DEFAULT_VIEW);
  });

  it("leaves default choices out of the query", () => {
    expect(viewToQuery(DEFAULT_VIEW)).toBe("");
    expect(viewToQuery({ group: "color", sort: "featured" })).toBe("?group=color");
    expect(viewToQuery({ group: "all", sort: "price-asc" })).toBe("?sort=price-asc");
    expect(viewToQuery({ group: "skincare", sort: "name" })).toBe("?group=skincare&sort=name");
  });

  it("round-trips through parse", () => {
    const view: ShopView = { group: "skincare", sort: "price-desc" };
    expect(parseView(params(viewToQuery(view)))).toEqual(view);
  });
});
