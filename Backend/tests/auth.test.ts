import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/services/auth.js";

describe("password hashing", () => {
  it("accepts the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("a long enough passphrase");
    expect(await verifyPassword("a long enough passphrase", hash)).toBe(true);
    expect(await verifyPassword("a different passphrase", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same passphrase"), hashPassword("same passphrase")]);
    expect(a).not.toBe(b);
  });

  it("never stores the password itself", async () => {
    expect(await hashPassword("visible passphrase")).not.toContain("visible passphrase");
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$aa$bb")).toBe(false);
  });
});
