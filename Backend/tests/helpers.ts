import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/create-app.js";
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

// Pooled and direct connections to one database differ only by "-pooler" in the host name.
const endpointOf = (url: string) => new URL(url).hostname.replace(/-pooler(?=\.)/, "");

// The tests wipe every table, so they must never be pointed at the public demo. Two checks:
// the demo database's host (set DEMO_DATABASE_HOST, not a secret) is refused by name, and any
// database carrying the demo marker row is refused once connected. The marker is what makes
// this hold even when nobody has set the host.
function refuseDemoHost(url: string) {
  const demoHost = process.env.DEMO_DATABASE_HOST;
  if (demoHost && endpointOf(url) === endpointOf(`postgresql://x@${demoHost}/x`)) {
    throw new Error("TEST_DATABASE_URL points at the demo database. The tests refuse to run there.");
  }
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
  refuseDemoHost(url);

  const config = loadConfig({
    DATABASE_URL: url,
    NODE_ENV: "test",
    CORS_ORIGINS: ORIGIN,
    ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: await hashPassword(ADMIN_PASSWORD),
    // Settings are strings in the environment, so booleans and numbers are written out as such.
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [key, value === undefined ? undefined : String(value)])
    ),
  });

  const { db, pool } = createDb(url, { max: 10 });
  await refuseDemoMarker(db, pool);
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
      sql`truncate table admin_sessions, inventory_movements, order_items, orders, rate_limits restart identity cascade`
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

// Second line of defence: a database that says it is the demo is never touched.
async function refuseDemoMarker(db: Db, pool: { end: () => Promise<void> }) {
  const rows = await db.execute(
    sql`select 1 from information_schema.tables where table_name = 'app_meta'`
  );
  if (rows.rows.length === 0) return;
  const marked = await db.execute(
    sql`select 1 from app_meta where key = 'database_role' and value = 'demo'`
  );
  if (marked.rows.length > 0) {
    await pool.end();
    throw new Error("This database is marked as the demo database. The tests refuse to run there.");
  }
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

// The rule that must hold after any amount of concurrent activity: every item's stock is
// never negative, and equals the sum of its recorded movements. An empty result means it holds.
export async function ledgerProblems(db: Db): Promise<{ sku_id: string; stock: number; ledger: number }[]> {
  const result = await db.execute(sql`
    select s.id as sku_id, s.stock, coalesce(sum(m.delta), 0)::int as ledger
    from skus s left join inventory_movements m on m.sku_id = s.id
    group by s.id, s.stock
    having s.stock < 0 or s.stock <> coalesce(sum(m.delta), 0)
  `);
  return result.rows as { sku_id: string; stock: number; ledger: number }[];
}

// Sets an item's stock and records why, so the ledger still adds up.
export async function setStock(db: Db, skuId: string, stock: number): Promise<void> {
  await db.execute(sql`
    with old as (select stock from skus where id = ${skuId}),
    upd as (update skus set stock = ${stock} where id = ${skuId} returning id)
    insert into inventory_movements (sku_id, delta, stock_after, reason, note)
    select ${skuId}, ${stock} - old.stock, ${stock}, 'adjustment', 'test setup' from old, upd
  `);
}
