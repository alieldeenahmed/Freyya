import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

// What the proxy tells the rest of Next to do with the request: the headers it set, by name.
function forwarded(response: Response) {
  const names = (response.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);
  const out: Record<string, string | null> = {};
  for (const name of names) out[name] = response.headers.get(`x-middleware-request-${name}`);
  return out;
}

const call = (headers: Record<string, string>) =>
  proxy(new NextRequest("https://freyya.example/api/orders", { method: "POST", headers }));

describe("passing the visitor's address to the API", () => {
  it("adds nothing at all when no secret is configured", () => {
    vi.stubEnv("PROXY_SECRET", "");
    const response = call({ "x-forwarded-for": "203.0.113.7" });

    const headers = forwarded(response);
    expect(headers["x-freyya-client-ip"]).toBeUndefined();
    expect(headers["x-freyya-proxy-secret"]).toBeUndefined();
  });

  it("passes on the address the host reported, with the secret", () => {
    vi.stubEnv("PROXY_SECRET", "a-shared-secret-of-enough-length");
    const headers = forwarded(call({ "x-forwarded-for": "203.0.113.7" }));

    expect(headers["x-freyya-client-ip"]).toBe("203.0.113.7");
    expect(headers["x-freyya-proxy-secret"]).toBe("a-shared-secret-of-enough-length");
  });

  it("takes the first address when there are several, and understands IPv6", () => {
    vi.stubEnv("PROXY_SECRET", "a-shared-secret-of-enough-length");
    expect(forwarded(call({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))["x-freyya-client-ip"]).toBe("203.0.113.7");
    expect(forwarded(call({ "x-forwarded-for": "2001:db8::1" }))["x-freyya-client-ip"]).toBe("2001:db8::1");
  });

  it("falls back to X-Real-Ip", () => {
    vi.stubEnv("PROXY_SECRET", "a-shared-secret-of-enough-length");
    expect(forwarded(call({ "x-real-ip": "198.51.100.9" }))["x-freyya-client-ip"]).toBe("198.51.100.9");
  });

  it("throws away a header the visitor tried to send themselves", () => {
    vi.stubEnv("PROXY_SECRET", "a-shared-secret-of-enough-length");
    const headers = forwarded(
      call({
        "x-forwarded-for": "203.0.113.7",
        "x-freyya-client-ip": "198.51.100.1",
        "x-freyya-proxy-secret": "guess",
      })
    );

    expect(headers["x-freyya-client-ip"]).toBe("203.0.113.7");
    expect(headers["x-freyya-proxy-secret"]).toBe("a-shared-secret-of-enough-length");
  });

  it("sends neither header when there is no usable address, rather than a wrong one", () => {
    vi.stubEnv("PROXY_SECRET", "a-shared-secret-of-enough-length");
    for (const value of ["not an address", "999.1.1.1", ""]) {
      const headers = forwarded(call({ "x-forwarded-for": value, "x-freyya-client-ip": "198.51.100.1" }));
      expect(headers["x-freyya-client-ip"], value).toBeUndefined();
      expect(headers["x-freyya-proxy-secret"], value).toBeUndefined();
    }
  });
});
