import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Order numbers are read aloud and typed in, so the look-alike characters are left out.
export function generateOrderId(): string {
  let suffix = "";
  for (let i = 0; i < 7; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `FRY-${suffix}`;
}
