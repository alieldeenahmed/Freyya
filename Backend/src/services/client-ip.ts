import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Compares secrets without leaking how much of them matched, or how long they are.
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

// The address to count requests against.
//
// Behind the storefront's /api rewrite, every request reaches the API from the storefront's
// own servers, and the host overwrites X-Forwarded-For with that address. Counted as it
// stands, one visitor going over a limit would lock out everyone. So the storefront
// forwards the visitor's address in X-Freyya-Client-Ip, together with a secret it shares
// with the API. The header is believed only when the secret matches and the value is a real
// address. Anyone else sending it, with no secret or a wrong one, is counted by the address
// the connection came from.
export function clientIp(request: FastifyRequest): string {
  const secret = request.server.ctx.config.PROXY_SECRET;
  const given = request.headers["x-freyya-proxy-secret"];
  const claimed = request.headers["x-freyya-client-ip"];

  if (
    secret &&
    typeof given === "string" &&
    typeof claimed === "string" &&
    safeEqual(given, secret) &&
    isIP(claimed.trim()) !== 0
  ) {
    return claimed.trim();
  }
  return request.ip;
}
