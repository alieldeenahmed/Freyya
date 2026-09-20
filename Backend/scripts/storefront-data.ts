import { readFileSync } from "node:fs";
import path from "node:path";
import {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_PER_ITEM,
  SHIPPING_METHODS,
} from "../src/domain/pricing.js";

// The API owns the catalog and the shop's rules. The storefront keeps a snapshot of both, so it
// can show the shop when the API cannot be reached (as on the public demo, where there is no
// API) and so its tests have data to run against. The snapshot is written from the API's own
// files by this module. Nobody edits it by hand.

const root = path.resolve(import.meta.dirname, "..");
export const STOREFRONT_DATA = path.resolve(root, "../Frontend/data");

const NOTICE = (source: string) =>
  `// GENERATED from ${source} by \`npm run sync:data\`. Do not edit by hand.\n` +
  `// The API is the authority. This is a snapshot for when the API cannot be reached, and the\n` +
  `// data the storefront's tests run against.\n`;

const lf = (text: string) => text.replace(/\r\n/g, "\n");

export function renderProducts(): string {
  const seed = lf(readFileSync(path.join(root, "src/db/seed-data.ts"), "utf8"));
  const marker = "export const seedProducts: SeedProduct[] =";
  const at = seed.indexOf(marker);
  if (at === -1) throw new Error(`${marker} not found in src/db/seed-data.ts`);

  return (
    NOTICE("Backend/src/db/seed-data.ts") +
    `import type { Product } from "@/lib/types";\n\n` +
    `export const products: Product[] =` +
    seed.slice(at + marker.length)
  );
}

const dollars = (cents: number) => cents / 100;

export function renderShopRules(): string {
  const methods = SHIPPING_METHODS.map((method) => {
    const parts = [
      `id: ${JSON.stringify(method.id)}`,
      `label: ${JSON.stringify(method.label)}`,
      `eta: ${JSON.stringify(method.eta)}`,
      `price: ${dollars(method.priceCents)}`,
      ...(method.freeOverCents !== undefined ? [`freeOver: ${dollars(method.freeOverCents)}`] : []),
    ];
    return `  { ${parts.join(", ")} },`;
  }).join("\n");

  return (
    NOTICE("Backend/src/domain/pricing.ts") +
    `\n` +
    `export type ShippingId = ${SHIPPING_METHODS.map((m) => JSON.stringify(m.id)).join(" | ")};\n\n` +
    `export interface ShippingMethod {\n` +
    `  id: ShippingId;\n` +
    `  label: string;\n` +
    `  eta: string;\n` +
    `  price: number;\n` +
    `  // Standard shipping is free above this subtotal.\n` +
    `  freeOver?: number;\n` +
    `}\n\n` +
    `export const FREE_SHIPPING_THRESHOLD = ${dollars(FREE_SHIPPING_THRESHOLD_CENTS)};\n\n` +
    `// The most of one item a single order can hold, however many lines it is spread over.\n` +
    `export const MAX_PER_ITEM = ${MAX_PER_ITEM};\n\n` +
    `export const SHIPPING_METHODS: ShippingMethod[] = [\n${methods}\n];\n\n` +
    `export const COUNTRIES = [\n${COUNTRIES.map((c) => `  ${JSON.stringify(c)},`).join("\n")}\n];\n`
  );
}

export const FILES: { file: string; render: () => string }[] = [
  { file: "products.ts", render: renderProducts },
  { file: "shop-rules.ts", render: renderShopRules },
];
