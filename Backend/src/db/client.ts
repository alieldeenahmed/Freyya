import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export interface PoolOptions {
  max?: number;
  idleTimeoutMillis?: number;
}

// One small pool per running instance. On a serverless host many instances can be alive at
// once, and the database (behind its pooler) has a fixed number of connections to share, so
// each instance keeps few and gives idle ones back quickly.
//
// The pooler runs in transaction mode: a connection is only yours for one transaction. So no
// request path may rely on session state (SET, LISTEN, session-level advisory locks, temp
// tables). Row locks and transaction-scoped locks inside a transaction are fine.
export function createDb(connectionString: string, options: PoolOptions = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 5,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
