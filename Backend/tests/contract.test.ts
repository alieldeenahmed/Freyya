import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FILES, STOREFRONT_DATA } from "../scripts/storefront-data.js";
import {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_PER_ITEM,
  SHIPPING_METHODS,
} from "../src/domain/pricing.js";
import { orderInputSchema } from "../src/schemas.js";
import { validOrder } from "./helpers.js";

// The API owns the catalog and the shop's rules. The storefront keeps a generated snapshot of
// them (Frontend/data), so it can show the shop when the API cannot be reached. These tests
// fail the moment the snapshot stops matching, or someone hand-writes a rule the storefront
// should be getting from the snapshot.

const frontend = path.resolve(import.meta.dirname, "../../Frontend");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const readFrontend = (file: string) => lf(readFileSync(path.join(frontend, file), "utf8"));

describe.skipIf(!existsSync(frontend))("the storefront's snapshot of the API's data", () => {
  it.each(FILES.map(({ file, render }) => [file, render] as const))(
    "Frontend/data/%s is exactly what the generator writes from the API's own files",
    (file, render) => {
      const current = lf(readFileSync(path.join(STOREFRONT_DATA, file), "utf8"));
      expect(
        current === render(),
        `Frontend/data/${file} is out of date. Run "npm run sync:data" from the repository root.`
      ).toBe(true);
    }
  );

  it("is marked as generated, so nobody edits it by hand", () => {
    for (const { file } of FILES) {
      expect(readFrontend(`data/${file}`)).toMatch(/^\/\/ GENERATED from .* Do not edit by hand\./);
    }
  });

  it("holds the same shipping rules, prices and limits as the API, in dollars", () => {
    const text = readFrontend("data/shop-rules.ts");

    expect(text).toContain(`FREE_SHIPPING_THRESHOLD = ${FREE_SHIPPING_THRESHOLD_CENTS / 100};`);
    expect(text).toContain(`MAX_PER_ITEM = ${MAX_PER_ITEM};`);
    for (const method of SHIPPING_METHODS) {
      expect(text).toContain(
        `id: "${method.id}", label: "${method.label}", eta: "${method.eta}", price: ${method.priceCents / 100}`
      );
    }
    for (const country of COUNTRIES) expect(text).toContain(`"${country}"`);
  });

  it("states the limit the API really enforces", () => {
    const within = orderInputSchema.safeParse(
      validOrder({ items: [{ skuId: "dawn-cleanse", quantity: MAX_PER_ITEM }] })
    );
    const over = orderInputSchema.safeParse(
      validOrder({ items: [{ skuId: "dawn-cleanse", quantity: MAX_PER_ITEM + 1 }] })
    );
    expect(within.success).toBe(true);
    expect(over.success).toBe(false);
  });
});

describe.skipIf(!existsSync(frontend))("the storefront's own code", () => {
  const stripComments = (code: string) => code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("does not write out shipping prices, countries or the order limit itself", () => {
    const shipping = stripComments(readFrontend("lib/shipping.ts"));

    expect(shipping).toContain('from "@/data/shop-rules"');
    expect(shipping).not.toMatch(/FREE_SHIPPING_THRESHOLD\s*=/);
    expect(shipping).not.toMatch(/SHIPPING_METHODS\s*(:[^=]+)?=/);
    expect(shipping).not.toMatch(/COUNTRIES\s*=/);
    expect(shipping).not.toMatch(/price:\s*\d/);
  });

  it("takes the order limit from the snapshot, not from a number of its own", () => {
    const cart = stripComments(readFrontend("lib/cart-store.ts"));
    expect(cart).toContain('from "@/data/shop-rules"');
    expect(cart).not.toMatch(/MAX_PER_ITEM\s*=\s*\d/);
  });

  it("does not keep another copy of the catalog anywhere but the snapshot", () => {
    for (const file of ["lib/catalog.ts", "lib/products.ts", "lib/quiz.ts", "lib/shop.ts"]) {
      expect(stripComments(readFrontend(file)), file).not.toMatch(
        /name:\s*"(Dawn Cleanse|Golden Hour Serum|Freyya Balm)"/
      );
    }
  });
});
