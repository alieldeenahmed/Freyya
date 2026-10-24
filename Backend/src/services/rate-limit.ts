import { sql } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { Db } from "../db/client.js";
import { HttpError } from "../errors.js";
import { clientIp } from "./client-ip.js";

export interface Hit {
  count: number;
  retryAfterSeconds: number;
}

// Counts one request against a key, in a window that starts at the first request and lasts
// `windowSeconds`. One statement does it all, so concurrent callers, on any number of
// instances, are counted exactly and in order. The window is measured by the database clock.
export async function hit(db: Db, key: string, windowSeconds: number): Promise<Hit> {
  const result = await db.execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits as r (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      window_start = case
        when r.window_start + make_interval(secs => ${windowSeconds}::int) <= now() then now()
        else r.window_start end,
      count = case
        when r.window_start + make_interval(secs => ${windowSeconds}::int) <= now() then 1
        else r.count + 1 end
    returning
      count,
      greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => ${windowSeconds}::int) - now()))))::int as retry_after
  `);
  const row = result.rows[0]!;
  return { count: row.count, retryAfterSeconds: row.retry_after };
}

// Removes counters whose window ended long ago. Run by the scheduled sweep.
export async function clearOldCounters(db: Db): Promise<number> {
  const result = await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  return result.rowCount ?? 0;
}

export interface Limit {
  // Names the bucket, so one route's count is not another's.
  name: string;
  max: number;
  windowSeconds: number;
}

// A pre-handler that refuses a caller who has gone over a limit, shared by every instance.
export function limitByAddress(db: Db, enabled: boolean, limit: Limit) {
  return async (request: FastifyRequest) => {
    if (!enabled) return;
    const { count, retryAfterSeconds } = await hit(db, `${limit.name}:${clientIp(request)}`, limit.windowSeconds);
    if (count > limit.max) {
      throw new HttpError(
        429,
        "rate_limited",
        `Too many requests. Try again in ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"}.`,
        undefined,
        { "retry-after": String(retryAfterSeconds) }
      );
    }
  };
}
