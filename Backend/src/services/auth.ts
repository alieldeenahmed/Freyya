import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { adminSessions } from "../db/schema.js";

const KEY_LENGTH = 64;
const SCRYPT = { N: 16384, r: 8, p: 1 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// Stored as "scrypt$<salt hex>$<hash hex>". Memory-hard, so guessing offline is slow.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(db: Db, email: string, hours: number) {
  const token = randomBytes(32).toString("base64url");

  // Expiry is the database's clock plus the session length, and so is every later check.
  const [session] = await db
    .insert(adminSessions)
    .values({
      id: sha256(token),
      email,
      expiresAt: sql`now() + make_interval(hours => ${hours}::int)`,
    })
    .returning({ expiresAt: adminSessions.expiresAt });
  // Old sessions are cleared as new ones are made, so there is no separate clean-up job.
  await db.delete(adminSessions).where(lte(adminSessions.expiresAt, sql`now()`));

  return { token, expiresAt: session!.expiresAt };
}

export async function findSession(db: Db, token: string): Promise<{ email: string } | null> {
  const [session] = await db
    .select({ email: adminSessions.email })
    .from(adminSessions)
    .where(and(eq(adminSessions.id, sha256(token)), gt(adminSessions.expiresAt, sql`now()`)))
    .limit(1);

  return session ? { email: session.email } : null;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.id, sha256(token)));
}
