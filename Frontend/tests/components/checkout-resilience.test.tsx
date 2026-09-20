// @vitest-environment jsdom
// Checkout when things go wrong at the edges: a slow or missing store, a bag the shop has
// changed, and a copy of the site that has no API at all.
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutForm from "@/components/CheckoutForm";
import { products } from "@/data/products";
import { renderWithProviders } from "../render";
import { router } from "../mocks/next-navigation";

interface Call {
  url: string;
  headers: Headers;
  body: { items: { quantity: number }[] } | undefined;
}

// Replaces fetch. The handler answers each call with a Response, or returns an error to throw.
function mockApi(handler: (call: Call, calls: Call[]) => Response | Error | DOMException) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: String(input),
        headers: new Headers(init?.headers as HeadersInit),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const result = handler(call, calls);
      // jsdom's DOMException is not an Error in this environment, so check for both.
      if (result instanceof Error || result instanceof DOMException) throw result;
      return result;
    })
  );
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiError = (status: number, code: string, message: string, details?: unknown) =>
  json(status, { error: { code, message, details } });

const order = (status = "pending_payment") => ({
  id: "FRY-TEST123",
  placedAt: "2026-09-19T10:00:00.000Z",
  email: "sara@example.com",
  name: "Sara Nasser",
  address: { line1: "12 Nile Corniche", city: "Cairo", postalCode: "11511", country: "Egypt" },
  shippingId: "standard",
  items: [
    { id: "dawn-cleanse", productId: "dawn-cleanse", name: "Dawn Cleanse", price: 28, color: "#E8C4B8", image: "/x.jpg", quantity: 2 },
  ],
  totals: { subtotal: 56, shipping: 6, total: 62 },
  currency: "USD",
  status,
});

const succeeds = (call: Call) =>
  call.url.endsWith("/pay") ? json(200, { order: order("paid") }) : json(201, { order: order() });

const dawn = (quantity = 2) => ({ id: "dawn-cleanse", productId: "dawn-cleanse", quantity });
const seedBag = (...lines: Record<string, unknown>[]) =>
  window.localStorage.setItem("freyya:cart", JSON.stringify(lines));
const savedBag = () => JSON.parse(window.localStorage.getItem("freyya:cart") ?? "[]");

type User = ReturnType<typeof userEvent.setup>;

async function fillIn(user: User) {
  await user.type(screen.getByLabelText("Email"), "sara@example.com");
  await user.type(screen.getByLabelText("Full name"), "Sara Nasser");
  await user.type(screen.getByLabelText("Address"), "12 Nile Corniche");
  await user.type(screen.getByLabelText("City"), "Cairo");
  await user.type(screen.getByLabelText("Postal code"), "11511");
}

const placeOrderButton = () => screen.getByRole("button", { name: /Place order|Placing order/ }) as HTMLButtonElement;
const keysOf = (calls: Call[]) => calls.filter((c) => c.url === "/api/orders").map((c) => c.headers.get("idempotency-key"));

function setup(bag: Record<string, unknown>[] = [dawn()]) {
  seedBag(...bag);
  const user = userEvent.setup();
  renderWithProviders(<CheckoutForm />);
  return user;
}

afterEach(() => vi.unstubAllGlobals());

describe("Checkout form: when the store is slow, down or objects", () => {
  const timeout = () => new DOMException("The operation timed out.", "TimeoutError");

  it("explains a timeout, keeps the bag, and retries with the same key", async () => {
    let orderCalls = 0;
    const calls = mockApi((call) => {
      if (call.url.endsWith("/pay")) return json(200, { order: order("paid") });
      orderCalls += 1;
      return orderCalls === 1 ? timeout() : json(200, { order: order() });
    });
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    const message = await screen.findByText(/took too long/);
    expect(message.textContent).toMatch(/bag is safe/);
    expect(message.textContent).toMatch(/not be charged twice/);
    expect(savedBag()).toHaveLength(1);
    expect(placeOrderButton().disabled).toBe(false);

    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const keys = keysOf(calls);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("says the store is not answering when the proxy returns an HTML error page", async () => {
    mockApi(() => new Response("<html>Bad Gateway</html>", { status: 502 }));
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/not answering/);
    expect(alert.textContent).not.toMatch(/html|Bad Gateway/i);
    expect(placeOrderButton().disabled).toBe(false);
    expect(savedBag()).toHaveLength(1);
  });

  it("asks the shopper to wait when rate limited, and lets them try again with the same key", async () => {
    let n = 0;
    const calls = mockApi((call) => {
      if (call.url.endsWith("/pay")) return json(200, { order: order("paid") });
      n += 1;
      return n === 1 ? apiError(429, "rate_limited", "Rate limit exceeded") : json(201, { order: order() });
    });
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();

    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const keys = keysOf(calls);
    expect(keys[0]).toBe(keys[1]);
  });

  it("finishes an order whose payment step is what dropped, without making a second order", async () => {
    let pays = 0;
    const calls = mockApi((call) => {
      if (call.url.endsWith("/pay")) {
        pays += 1;
        return pays === 1 ? new TypeError("Failed to fetch") : json(200, { order: order("paid") });
      }
      // The retry finds the order the first request made, and is given it back.
      return json(keysOf(calls).length === 1 ? 201 : 200, { order: order() });
    });
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());
    await screen.findByText(/Could not reach the store/);
    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const keys = keysOf(calls);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(savedBag()).toEqual([]);
  });

  it("explains a request key that was reused, and starts fresh on the next try", async () => {
    const calls = mockApi(() => apiError(422, "idempotency_key_reused", "That request key was already used"));
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Something changed/);
    expect(alert.textContent).not.toMatch(/key/i);

    await user.click(placeOrderButton());
    await waitFor(() => expect(calls).toHaveLength(2));
    const keys = keysOf(calls);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("names the limit per order when the store objects to the bag, and checks the bag again", async () => {
    mockApi(() =>
      apiError(400, "validation_error", "Some fields are missing or invalid.", [
        { path: "items.0.quantity", message: "too big" },
      ])
    );
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/at most 10/);
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByText(/highlighted/)).toBeNull();
  });

  it("never sends more than ten of an item, whatever the bag says", async () => {
    const calls = mockApi(succeeds);
    // Dawn Cleanse has 24 in stock, and the store refuses more than ten in one order.
    const user = setup([dawn(24)]);

    expect(screen.getByRole("complementary", { name: "Order summary" }).textContent).toContain("$280");
    await fillIn(user);
    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    expect(calls.find((c) => c.url === "/api/orders")!.body!.items[0]!.quantity).toBe(10);
  });

  it("cannot be typed past what the store accepts", () => {
    setup();
    const limits: [string, number][] = [
      ["Email", 254],
      ["Full name", 100],
      ["Address", 120],
      ["City", 80],
      ["Postal code", 20],
    ];
    for (const [label, max] of limits) {
      expect(screen.getByLabelText(label).getAttribute("maxlength"), label).toBe(String(max));
    }
  });
});

describe("Checkout form: a bag the shop has changed", () => {
  const soldOut = (id: string) => products.map((p) => (p.id === id ? { ...p, stock: 0 } : p));

  it("says an item sold out, and clears the message once it has been read", async () => {
    seedBag(dawn(2), { id: "veil-spf", productId: "veil-spf", name: "Veil SPF", quantity: 1 });
    const user = userEvent.setup();
    renderWithProviders(<CheckoutForm />, soldOut("veil-spf"));

    const note = screen.getByText("Your bag changed").closest("[role=status]")!;
    expect(note.textContent).toContain("Veil SPF has sold out, so it was taken out of your bag.");
    expect(screen.getByRole("complementary", { name: "Order summary" }).textContent).not.toContain("Veil SPF");

    await user.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.queryByText("Your bag changed")).toBeNull();
    expect(savedBag().map((line: { id: string }) => line.id)).toEqual(["dawn-cleanse"]);
  });

  it("explains that the bag is empty because everything sold out", () => {
    seedBag(dawn(2));
    renderWithProviders(<CheckoutForm />, soldOut("dawn-cleanse"));

    expect(screen.getByText("Your bag changed")).toBeTruthy();
    expect(screen.getByText(/Your bag is empty/)).toBeTruthy();
  });

  it("says nothing when the bag is fine", () => {
    setup();
    expect(screen.queryByText("Your bag changed")).toBeNull();
  });
});

describe("Checkout form: a copy of the site with no store server", () => {
  it("says orders cannot be placed, and why", () => {
    seedBag(dawn());
    renderWithProviders(<CheckoutForm />, products, false);

    const note = screen.getByRole("note");
    expect(note.textContent).toMatch(/can't reach its API/);
    expect(note.textContent).toMatch(/run the project locally/i);
    // The form is still there, so a visitor can look at everything.
    expect(screen.getByRole("form", { name: "Checkout" })).toBeTruthy();
  });

  it("says nothing when the store is reachable", () => {
    setup();
    expect(screen.queryByRole("note")).toBeNull();
  });
});
