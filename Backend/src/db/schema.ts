import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export interface ProductDetails {
  ingredients: string;
  skinTypes: string[];
  size: string;
  usage: string;
}

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    priceCents: integer("price_cents").notNull(),
    specs: jsonb("specs").$type<string[]>().notNull(),
    color: text("color").notNull(),
    image: text("image").notNull(),
    showcase: jsonb("showcase").$type<string[]>(),
    details: jsonb("details").$type<ProductDetails>().notNull(),
    related: jsonb("related").$type<string[]>().notNull().default([]),
    isHero: boolean("is_hero").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [check("products_price_positive", sql`${t.priceCents} > 0`)]
);

// One row per thing that can be bought and counted: a product with no shades has
// a single SKU, a product with shades has one per shade. Stock lives here.
// A SKU id matches the frontend's cart line id: "serum" or "balm:bare".
export const skus = pgTable(
  "skus",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id"),
    variantName: text("variant_name"),
    hex: text("hex"),
    image: text("image"),
    undertone: text("undertone"),
    intensity: text("intensity"),
    sortOrder: integer("sort_order").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The last line of defence against overselling: the database refuses negative stock.
    check("skus_stock_non_negative", sql`${t.stock} >= 0`),
    index("skus_product_idx").on(t.productId),
  ]
);

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPPING_IDS = ["standard", "express"] as const;
export type ShippingId = (typeof SHIPPING_IDS)[number];

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    // Lets a client retry a checkout request without creating a second order.
    idempotencyKey: text("idempotency_key").unique(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull(),
    shippingMethod: text("shipping_method", { enum: SHIPPING_IDS }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending_payment"),
    paymentRef: text("payment_ref"),
    // While unpaid, stock is held until this time, then released.
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "orders_status_valid",
      sql`${t.status} in ('pending_payment','paid','shipped','delivered','cancelled','refunded')`
    ),
    check("orders_totals_consistent", sql`${t.subtotalCents} + ${t.shippingCents} = ${t.totalCents}`),
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_email_idx").on(sql`lower(${t.email})`),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    skuId: text("sku_id")
      .notNull()
      .references(() => skus.id),
    productId: text("product_id").notNull(),
    // What the customer saw when they ordered, kept even if the product changes later.
    name: text("name").notNull(),
    variantName: text("variant_name"),
    color: text("color").notNull(),
    image: text("image").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    index("order_items_order_idx").on(t.orderId),
  ]
);

export const MOVEMENT_REASONS = [
  "seed",
  "order",
  "cancellation",
  "restock",
  "adjustment",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

// Every change to stock, so the count can always be explained.
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    skuId: text("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason", { enum: MOVEMENT_REASONS }).notNull(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    note: text("note"),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("movements_sku_created_idx").on(t.skuId, t.createdAt)]
);

export const adminSessions = pgTable("admin_sessions", {
  // SHA-256 of the cookie token, so a leaked table can't be used to sign in.
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
