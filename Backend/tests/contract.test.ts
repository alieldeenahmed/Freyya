import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_METHODS,
} from "../src/domain/pricing.js";

// The storefront and the API each keep a copy of the shipping rules and the catalog,
// so the packages can be deployed on their own. These tests read the storefront's
// files as text and fail as soon as the two copies stop agreeing.

const frontend = path.resolve(import.meta.dirname, "../../Frontend");
const read = (file: string) =>
  readFileSync(path.join(frontend, file), "utf8").replace(/\r\n/g, "\n");
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

describe.skipIf(!existsSync(frontend))("storefront and API agree", () => {
  describe("shipping rules", () => {
    const shipping = read("lib/shipping.ts");

    it("use the same free-shipping threshold", () => {
      const match = shipping.match(/FREE_SHIPPING_THRESHOLD = (\d+)/);
      expect(match, "threshold not found in Frontend/lib/shipping.ts").not.toBeNull();
      expect(Number(match![1]) * 100).toBe(FREE_SHIPPING_THRESHOLD_CENTS);
    });

    it("offer the same methods, prices and delivery times", () => {
      const parsed = [
        ...shipping.matchAll(
          /\{ id: "(\w+)", label: "([^"]+)", eta: "([^"]+)", price: (\d+)(, freeOver:)?/g
        ),
      ].map(([, id, label, eta, price, freeOver]) => ({
        id,
        label,
        eta,
        priceCents: Number(price) * 100,
        hasFreeOver: Boolean(freeOver),
      }));

      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed).toEqual(
        SHIPPING_METHODS.map((method) => ({
          id: method.id,
          label: method.label,
          eta: method.eta,
          priceCents: method.priceCents,
          hasFreeOver: method.freeOverCents !== undefined,
        }))
      );
    });

    it("deliver to the same countries", () => {
      const block = shipping.match(/COUNTRIES = \[([\s\S]*?)\];/);
      expect(block, "COUNTRIES not found in Frontend/lib/shipping.ts").not.toBeNull();
      const countries = [...(block![1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);

      expect(countries.length).toBeGreaterThan(0);
      expect(countries).toEqual([...COUNTRIES]);
    });
  });

  describe("catalog", () => {
    // The API's seed data began as a copy of the storefront's bundled catalog.
    const bodyAfter = (text: string, marker: RegExp) => {
      const match = marker.exec(text);
      expect(match, `${marker} not found`).not.toBeNull();
      return squash(text.slice(match!.index + match![0].length));
    };

    it("has the same products, prices, shades and stock in the bundled copy and the seed data", () => {
      const storefront = bodyAfter(
        read("data/products.ts"),
        /export const products: Product\[\] =/
      );
      const seed = bodyAfter(
        readFileSync(path.resolve(import.meta.dirname, "../src/db/seed-data.ts"), "utf8").replace(
          /\r\n/g,
          "\n"
        ),
        /export const seedProducts: SeedProduct\[\] =/
      );

      expect(storefront.length).toBeGreaterThan(1000);
      expect(seed).toBe(storefront);
    });
  });
});
