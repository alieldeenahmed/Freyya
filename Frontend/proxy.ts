import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";

// Runs on every call to the API (/api/*), which next.config.ts forwards to the API.
//
// The host overwrites X-Forwarded-For on every hop, so by the time a request reaches the API it
// carries this storefront's address and not the visitor's. The API counts requests per address
// to limit abuse, and would see everyone as one caller. So the visitor's real address, as this
// storefront received it, is passed along in X-Freyya-Client-Ip, together with a secret the
// API checks. Without the secret the API ignores the header, so no one can name their own address.
//
// With no PROXY_SECRET set (local development, previews) nothing is added and requests pass untouched.
export function proxy(request: NextRequest) {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return NextResponse.next();

  const headers = new Headers(request.headers);
  // Whatever the visitor sent under these names is theirs to forge, so it is dropped first.
  headers.delete("x-freyya-client-ip");
  headers.delete("x-freyya-proxy-secret");

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim();
  if (address && isIP(address) !== 0) {
    headers.set("x-freyya-client-ip", address);
    headers.set("x-freyya-proxy-secret", secret);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
