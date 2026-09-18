import { describe, expect, it } from "vitest";
import { getAllProducts, getProductById, getRelatedProducts, getStock } from "@/lib/products";

const products = getAllProducts();

describe("catalog", () => {
  it("has unique product ids", () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it("only relates products that exist, and never to themselves", () => {
    for (const product of products) {
      expect(product.related).not.toContain(product.id);
      expect(getRelatedProducts(product.id)).toHaveLength(product.related.length);
    }
  });

  it("tracks stock either on the product or on its shades", () => {
    for (const product of products) {
      if (product.variants) {
        expect(product.variants.length, product.id).toBeGreaterThan(0);
        for (const variant of product.variants) expect(variant.stock).toBeGreaterThanOrEqual(0);
      } else {
        expect(product.stock, product.id).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("getStock", () => {
  it("reads a shade's own stock", () => {
    expect(getStock(getProductById("freyya-balm")!, "terracotta")).toBe(2);
  });

  it("is zero for an unknown shade", () => {
    expect(getStock(getProductById("freyya-balm")!, "nope")).toBe(0);
  });

  it("reads product stock when there are no shades", () => {
    expect(getStock(getProductById("golden-hour-serum")!)).toBe(3);
  });
});
