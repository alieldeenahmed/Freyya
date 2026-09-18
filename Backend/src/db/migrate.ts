import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";

const { DATABASE_URL } = loadConfig();
const { db, pool } = createDb(DATABASE_URL);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
