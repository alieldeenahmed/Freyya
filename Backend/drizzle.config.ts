import { defineConfig } from "drizzle-kit";

// Only used to generate migrations from the schema; it never connects to the database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
