import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { findProduct, getRelatedProducts, getStock, isInStock } from "@/lib/products";

describe("catalog", () => {
  it("has unique product ids", () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it("only relates products that exist, and never to themselves", () => {
    for (const product of products) {
      expect(product.related).not.toContain(product.id);
      expect(getRelatedProducts(products, product.id)).toHaveLength(product.related.length);
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
    expect(getStock(findProduct(products, "freyya-balm")!, "terracotta")).toBe(2);
  });

  it("is zero for an unknown shade", () => {
    expect(getStock(findProduct(products, "freyya-balm")!, "nope")).toBe(0);
  });

  it("reads product stock when there are no shades", () => {
    expect(getStock(findProduct(products, "golden-hour-serum")!)).toBe(3);
  });
});

describe("isInStock", () => {
  it("is true when anything can be bought", () => {
    expect(isInStock(findProduct(products, "golden-hour-serum")!)).toBe(true);
    expect(isInStock(findProduct(products, "freyya-balm")!)).toBe(true);
  });

  it("is false when every unit or shade is gone", () => {
    const serum = { ...findProduct(products, "golden-hour-serum")!, stock: 0 };
    expect(isInStock(serum)).toBe(false);

    const balm = findProduct(products, "freyya-balm")!;
    const soldOut = { ...balm, variants: balm.variants!.map((v) => ({ ...v, stock: 0 })) };
    expect(isInStock(soldOut)).toBe(false);
  });
});
