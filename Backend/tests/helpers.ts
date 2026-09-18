import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { createDb, type Db } from "../src/db/client.js";
import { seedCatalog } from "../src/db/seed-catalog.js";
import { seedProducts } from "../src/db/seed-data.js";
import { hashPassword } from "../src/services/auth.js";

try {
  process.loadEnvFile(".env.test");
} catch {
  // The variable may already be set by the environment.
}

export const ADMIN_EMAIL = "admin@freyya.test";
export const ADMIN_PASSWORD = "correct horse battery staple";
export const ORIGIN = "http://localhost:3000";

export interface TestContext {
  db: Db;
  config: Config;
  app: FastifyInstance;
  close: () => Promise<void>;
  reset: () => Promise<void>;
}

// Everything runs against a disposable database branch. Refuse to touch anything else.
export async function createTestContext(
  overrides: Partial<Config> = {},
  options: { rateLimit?: boolean } = {}
): Promise<TestContext> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Put it in .env.test (a throwaway database).");
  }

  // The reset wipes every table, so make sure this can never be the real database.
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL.");
  }

  const config = loadConfig({
    DATABASE_URL: url,
    NODE_ENV: "test",
    CORS_ORIGINS: ORIGIN,
    ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: await hashPassword(ADMIN_PASSWORD),
    ...(overrides as Record<string, string>),
  });

  const { db, pool } = createDb(url);
  const app = await buildApp({ config, db, rateLimit: options.rateLimit ?? false });

  // Launch stock for every SKU, so a reset is a few statements instead of a full re-seed.
  const launchStock = seedProducts.flatMap((product) =>
    product.variants
      ? product.variants.map((v) => ({ id: `${product.id}:${v.id}`, stock: v.stock }))
      : [{ id: product.id, stock: product.stock ?? 0 }]
  );
  await seedCatalog(db);

  const reset = async () => {
    await db.execute(
      sql`truncate table admin_sessions, inventory_movements, order_items, orders restart identity cascade`
    );
    const rows = launchStock.map((row) => sql`(${row.id}, ${row.stock}::int)`);
    await db.execute(
      sql`update skus set stock = v.stock from (values ${sql.join(rows, sql`, `)}) as v(id, stock) where skus.id = v.id`
    );
    await db.execute(sql`update products set active = true`);
    await db.execute(
      sql`insert into inventory_movements (sku_id, delta, stock_after, reason, note) select id, stock, stock, 'seed', 'Launch stock' from skus`
    );
  };

  return {
    db,
    config,
    app,
    reset,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export const validOrder = (overrides: Record<string, unknown> = {}) => ({
  email: "sara@example.com",
  name: "Sara Nasser",
  address: {
    line1: "12 Nile Corniche",
    city: "Cairo",
    postalCode: "11511",
    country: "Egypt",
  },
  shippingId: "standard",
  items: [{ skuId: "dawn-cleanse", quantity: 1 }],
  ...overrides,
});
