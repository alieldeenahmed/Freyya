import { sql } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { HttpError } from "../errors.js";
import { safeEqual } from "../services/client-ip.js";
import { resetDemo } from "../services/demo.js";
import { clearOldCounters } from "../services/rate-limit.js";
import { sweepExpiredReservations } from "../services/reservations.js";

// Scheduled jobs. Each needs the shared CRON_SECRET as a Bearer token, which is how Vercel's own
// cron calls identify themselves too, and without a configured secret none of them runs.
export const internalRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.ctx;

  const requireCron = (request: FastifyRequest) => {
    if (!config.CRON_SECRET) {
      throw new HttpError(503, "jobs_not_configured", "Scheduled jobs are not set up.");
    }
    const header = request.headers.authorization;
    if (typeof header !== "string" || !safeEqual(header, `Bearer ${config.CRON_SECRET}`)) {
      throw new HttpError(401, "unauthorized", "Not allowed.");
    }
  };

  // Gives back the stock of unpaid orders whose hold has run out, and tidies old counters and
  // sessions. Safe to repeat, and safe to run twice at once. GET as well as POST, because that
  // is the method Vercel's cron uses.
  const sweep = async (request: FastifyRequest) => {
    requireCron(request);
    const released = await sweepExpiredReservations(db);
    const counters = await clearOldCounters(db);
    await db.execute(sql`delete from admin_sessions where expires_at <= now()`);
    return { released, clearedCounters: counters };
  };
  app.post("/sweep-reservations", sweep);
  app.get("/sweep-reservations", sweep);

  // Only the public demo, and only a database that is marked as the demo one.
  app.post("/demo-reset", async (request) => {
    requireCron(request);
    return { reset: await resetDemo(db, config) };
  });
};
