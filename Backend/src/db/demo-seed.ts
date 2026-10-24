import type { OrderStatus, ShippingId } from "./schema.js";
import { seedProducts } from "./seed-data.js";

// What the public demo's database looks like right after its nightly reset: the launch catalog,
// plus a handful of clearly fake orders in different states, so the admin dashboard is not empty.
// Nothing here is a real person. The addresses are made up and the emails end in example.com.

export interface DemoOrder {
  id: string;
  name: string;
  email: string;
  shippingId: ShippingId;
  status: OrderStatus;
  items: { skuId: string; quantity: number }[];
  // How long ago it was placed, so the dashboard always looks recent.
  hoursAgo: number;
}

export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "FRY-DEMO001",
    name: "Demo Customer One",
    email: "demo.one@example.com",
    shippingId: "standard",
    status: "paid",
    items: [
      { skuId: "dawn-cleanse", quantity: 1 },
      { skuId: "veil-spf", quantity: 1 },
    ],
    hoursAgo: 3,
  },
  {
    id: "FRY-DEMO002",
    name: "Demo Customer Two",
    email: "demo.two@example.com",
    shippingId: "express",
    status: "shipped",
    items: [{ skuId: "golden-hour-serum", quantity: 1 }],
    hoursAgo: 30,
  },
  {
    id: "FRY-DEMO003",
    name: "Demo Customer Three",
    email: "demo.three@example.com",
    shippingId: "standard",
    status: "delivered",
    items: [{ skuId: "freyya-balm:bare", quantity: 2 }],
    hoursAgo: 80,
  },
  {
    id: "FRY-DEMO004",
    name: "Demo Customer Four",
    email: "demo.four@example.com",
    shippingId: "standard",
    status: "cancelled",
    items: [{ skuId: "second-skin-cream", quantity: 1 }],
    hoursAgo: 52,
  },
  {
    id: "FRY-DEMO005",
    name: "Demo Customer Five",
    email: "demo.five@example.com",
    shippingId: "standard",
    status: "refunded",
    items: [{ skuId: "dew-drops:champagne", quantity: 1 }],
    hoursAgo: 120,
  },
];

export const demoAddress = (n: number) => ({
  line1: `${n} Demo Street`,
  city: "Demoville",
  postalCode: "00000",
  country: "United States",
});

// The stock of every item right after a reset: the launch stock, less what the demo orders
// that were not cancelled are holding. (A cancelled order took its stock and gave it back.)
export function expectedDemoStock(): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const product of seedProducts) {
    if (product.variants) {
      for (const variant of product.variants) stock[`${product.id}:${variant.id}`] = variant.stock;
    } else {
      stock[product.id] = product.stock ?? 0;
    }
  }
  for (const order of DEMO_ORDERS) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) stock[item.skuId] = (stock[item.skuId] ?? 0) - item.quantity;
  }
  return stock;
}

// The row that says a database is the demo one. The reset refuses to run without it.
export const DEMO_MARKER = { key: "database_role", value: "demo" } as const;
