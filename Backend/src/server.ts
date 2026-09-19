import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { expireReservations } from "./services/orders.js";

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const app = await buildApp({ config, db, logger: true, rateLimit: config.RATE_LIMIT });

// Unpaid orders hold stock. Give it back once the hold runs out.
const sweep = async () => {
  try {
    const released = await expireReservations(db);
    if (released > 0) app.log.info({ released }, "released expired reservations");
  } catch (error) {
    app.log.error(error, "failed to release expired reservations");
  }
};
await sweep();
const timer = setInterval(sweep, 60_000);
timer.unref();

const shutdown = async () => {
  clearInterval(timer);
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
