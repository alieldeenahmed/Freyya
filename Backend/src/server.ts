import Fastify from "fastify";
import { configureApp, fastifyOptions } from "./create-app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

// This file is the entrypoint both for local development (`npm run dev`, `npm start`) and for
// Vercel, which finds it by name, checks that it imports fastify, and routes requests to the
// instance once it is listening. That is why the instance is created here and not in create-app.ts.
//
// Nothing runs in the background. A serverless instance can be frozen or thrown away between
// requests, so a timer cannot be relied on. Expired stock holds are given back when an order
// is placed, when the catalog is read, and by the scheduled call to /internal/sweep-reservations.
console.log("startup: loading config");
const config = loadConfig();
console.log("startup: config ok, port", config.PORT);
const { db, pool } = createDb(config.DATABASE_URL, { max: config.DB_POOL_MAX });
const app = await configureApp(Fastify(fastifyOptions(config, true)), {
  config,
  db,
  logger: true,
  rateLimit: config.RATE_LIMIT,
});

console.log("startup: app configured");

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  console.log("startup: listening");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
