import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";

// Migrations use the direct connection when there is one. The pooler hands a connection to a
// different caller after every transaction, which is fine for requests and wrong for schema work.
const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL_UNPOOLED ?? config.DATABASE_URL, { max: 1 });

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
