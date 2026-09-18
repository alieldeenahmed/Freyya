import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { seedCatalog } from "./seed-catalog.js";

const { db, pool } = createDb(loadConfig().DATABASE_URL);

try {
  await seedCatalog(db);

  const products = (await pool.query("select count(*)::int as n from products")).rows[0].n;
  const skus = (await pool.query("select count(*)::int as n from skus")).rows[0].n;
  console.log(`Seeded ${products} products and ${skus} SKUs.`);
} finally {
  await pool.end();
}
