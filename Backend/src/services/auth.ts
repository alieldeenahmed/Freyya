import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
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
  const expiresAt = new Date(Date.now() + hours * 3_600_000);

  await db.insert(adminSessions).values({ id: sha256(token), email, expiresAt });
  // Old sessions are cleared as new ones are made, so there is no separate clean-up job.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));

  return { token, expiresAt };
}

export async function findSession(db: Db, token: string): Promise<{ email: string } | null> {
  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.id, sha256(token)))
    .limit(1);

  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return { email: session.email };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.id, sha256(token)));
}
