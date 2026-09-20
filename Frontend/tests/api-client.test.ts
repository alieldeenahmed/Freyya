import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

const answer = (body: BodyInit | null, init: ResponseInit = {}) =>
  vi.fn(async () => new Response(body, init));

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("Expected the request to fail");
};

describe("apiFetch", () => {
  it("returns what the API sent", async () => {
    vi.stubGlobal("fetch", answer(JSON.stringify({ ok: 1 }), { status: 200 }));
    expect(await apiFetch("/things")).toEqual({ ok: 1 });
  });

  it("sends JSON with the right header, through this site's own /api", async () => {
    const fetchMock = answer("{}", { status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/orders", { method: "POST", json: { a: 1 }, headers: { "idempotency-key": "k" } });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/orders");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ "content-type": "application/json", "idempotency-key": "k" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the API's own error code, message and details", async () => {
    vi.stubGlobal(
      "fetch",
      answer(
        JSON.stringify({ error: { code: "insufficient_stock", message: "Not enough.", details: { items: [] } } }),
        { status: 409 }
      )
    );
    const error = await failure(apiFetch("/orders"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "insufficient_stock",
      message: "Not enough.",
      details: { items: [] },
    });
  });

  it("reports a dropped connection as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await failure(apiFetch("/orders"));
    expect(error).toMatchObject({ status: 0, code: "network_error" });
  });

  it("gives up after the time allowed, and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          })
      )
    );
    const error = await failure(apiFetch("/orders", { timeoutMs: 25 }));
    expect(error).toMatchObject({ status: 0, code: "timeout" });
  });

  it.each([
    ["an HTML error page from the proxy", "<html>Internal Server Error</html>", 500],
    ["an empty gateway error", "", 502],
    ["a plain-text gateway timeout", "upstream timed out", 504],
    ["an unavailable service", "", 503],
  ])("treats %s as the store being unavailable", async (_label, body, status) => {
    vi.stubGlobal("fetch", answer(body, { status }));
    const error = await failure(apiFetch("/orders"));
    expect(error).toMatchObject({ status, code: "unavailable" });
    expect(error.message).toMatch(/try again/i);
    expect(error.message).not.toMatch(/html|Internal Server/i);
  });

  it("still passes on a JSON error the API itself sent with a 500", async () => {
    vi.stubGlobal(
      "fetch",
      answer(JSON.stringify({ error: { code: "internal_error", message: "Something went wrong." } }), {
        status: 500,
      })
    );
    expect(await failure(apiFetch("/orders"))).toMatchObject({ code: "internal_error" });
  });

  it("does not call a client error 'unavailable'", async () => {
    vi.stubGlobal("fetch", answer("not json", { status: 404 }));
    expect(await failure(apiFetch("/orders"))).toMatchObject({ status: 404, code: "error" });
  });

  it("does not crash on a success that is not JSON", async () => {
    vi.stubGlobal("fetch", answer("<html>captive portal</html>", { status: 200 }));
    expect(await failure(apiFetch("/orders"))).toMatchObject({ code: "unavailable" });
  });
});
