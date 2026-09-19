// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutForm from "@/components/CheckoutForm";
import { renderWithProviders } from "../render";
import { router } from "../mocks/next-navigation";

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
  headers: Headers;
}

// Replaces fetch. The handler answers each call with a Response, or throws to simulate a dropped connection.
function mockApi(handler: (call: Call, calls: Call[]) => Response | Error) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: new Headers(init?.headers as HeadersInit),
      };
      calls.push(call);
      const result = handler(call, calls);
      if (result instanceof Error) throw result;
      return result;
    })
  );
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const apiError = (status: number, code: string, message: string, details?: unknown) =>
  json(status, { error: { code, message, details } });

const orderFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "FRY-TEST123",
  placedAt: "2026-09-19T10:00:00.000Z",
  email: "sara@example.com",
  name: "Sara Nasser",
  address: { line1: "12 Nile Corniche", city: "Cairo", postalCode: "11511", country: "Egypt" },
  shippingId: "standard",
  items: [
    {
      id: "dawn-cleanse",
      productId: "dawn-cleanse",
      name: "Dawn Cleanse",
      price: 28,
      color: "#E8C4B8",
      image: "/products/dawn-cleanse.jpg",
      quantity: 2,
    },
  ],
  totals: { subtotal: 56, shipping: 6, total: 62 },
  currency: "USD",
  status: "pending_payment",
  ...overrides,
});

// The happy path: create the order, then pay for it.
const succeeds = (call: Call) =>
  call.url.endsWith("/pay")
    ? json(200, { order: orderFixture({ status: "paid" }) })
    : json(201, { order: orderFixture() });

function seedBag(...lines: Record<string, unknown>[]) {
  window.localStorage.setItem("freyya:cart", JSON.stringify(lines));
}
const dawn = (quantity = 2) => ({ id: "dawn-cleanse", productId: "dawn-cleanse", quantity });
const serum = (quantity: number) => ({ id: "golden-hour-serum", productId: "golden-hour-serum", quantity });

const savedBag = () => JSON.parse(window.localStorage.getItem("freyya:cart") ?? "[]");

type User = ReturnType<typeof userEvent.setup>;

async function fillIn(user: User, values: Partial<Record<"email" | "name" | "address" | "city" | "postal", string>> = {}) {
  const v = { email: "sara@example.com", name: "Sara Nasser", address: "12 Nile Corniche", city: "Cairo", postal: "11511", ...values };
  await user.type(screen.getByLabelText("Email"), v.email);
  await user.type(screen.getByLabelText("Full name"), v.name);
  await user.type(screen.getByLabelText("Address"), v.address);
  await user.type(screen.getByLabelText("City"), v.city);
  await user.type(screen.getByLabelText("Postal code"), v.postal);
}

const placeOrderButton = () => screen.getByRole("button", { name: /Place order|Placing order/ });

function setup(bag: Record<string, unknown>[] = [dawn()]) {
  seedBag(...bag);
  const user = userEvent.setup();
  renderWithProviders(<CheckoutForm />);
  return user;
}

afterEach(() => vi.unstubAllGlobals());

describe("Checkout form: what is shown", () => {
  it("says so when the bag is empty, and shows no form", () => {
    setup([]);

    expect(screen.getByText(/Your bag is empty/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop all" }).getAttribute("href")).toBe("/shop");
    expect(screen.queryByRole("form", { name: "Checkout" })).toBeNull();
  });

  it("summarises the bag with the shipping cost", () => {
    setup();

    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(summary.textContent).toContain("Dawn Cleanse");
    expect(summary.textContent).toContain("$56");
    expect(summary.textContent).toContain("$6");
    expect(summary.textContent).toContain("$62");
    expect(placeOrderButton().textContent).toBe("Place order · $62");
  });

  it("changes the total when express shipping is chosen", async () => {
    const user = setup();

    await user.click(screen.getByRole("radio", { name: /Express/ }));

    expect(placeOrderButton().textContent).toBe("Place order · $70");
  });

  it("waives standard shipping from $75", () => {
    setup([serum(2)]);

    expect(placeOrderButton().textContent).toBe("Place order · $116");
    expect(screen.getByRole("complementary", { name: "Order summary" }).textContent).toContain("Free");
  });

  it("says plainly that payment is simulated", () => {
    setup();
    expect(screen.getByText(/Payment is simulated/)).toBeTruthy();
  });
});

describe("Checkout form: validation", () => {
  it("explains every missing field, focuses the first, and sends nothing", async () => {
    const calls = mockApi(() => json(500, {}));
    const user = setup();

    await user.click(placeOrderButton());

    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "Enter a valid email address.",
      "Enter your full name.",
      "Enter your street address.",
      "Enter your city.",
      "Enter your postal code.",
    ]);
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
    expect(calls).toHaveLength(0);
  });

  it("clears a field's message as soon as it is edited", async () => {
    mockApi(() => json(500, {}));
    const user = setup();

    await user.click(placeOrderButton());
    expect(screen.getByText("Enter your city.")).toBeTruthy();

    await user.type(screen.getByLabelText("City"), "C");
    expect(screen.queryByText("Enter your city.")).toBeNull();
  });
});

describe("Checkout form: placing an order", () => {
  it("creates the order, pays for it, saves it, empties the bag and moves on", async () => {
    const calls = mockApi(succeeds);
    const user = setup();

    await fillIn(user);
    await user.click(document.getElementById("checkout-country")!);
    await user.click(screen.getByRole("option", { name: "Egypt" }));
    await user.click(placeOrderButton());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/checkout/confirmation"));

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/orders",
      "POST /api/orders/FRY-TEST123/pay",
    ]);
    expect(calls[1]!.body).toEqual({ email: "sara@example.com" });

    const saved = JSON.parse(window.localStorage.getItem("freyya:last-order")!);
    expect(saved).toMatchObject({ id: "FRY-TEST123", status: "paid" });
    expect(savedBag()).toEqual([]);
  });

  it("sends only what to buy and where, never a price or a total", async () => {
    const calls = mockApi(succeeds);
    const user = setup();

    await fillIn(user, { name: "  Sara Nasser  " });
    await user.click(document.getElementById("checkout-country")!);
    await user.click(screen.getByRole("option", { name: "Egypt" }));
    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const request = calls[0]!.body!;
    expect(request).toEqual({
      email: "sara@example.com",
      name: "Sara Nasser",
      address: { line1: "12 Nile Corniche", city: "Cairo", postalCode: "11511", country: "Egypt" },
      shippingId: "standard",
      items: [{ skuId: "dawn-cleanse", quantity: 2 }],
    });
    expect(JSON.stringify(request)).not.toMatch(/price|total/i);
    expect((calls[0]!.headers.get("idempotency-key") ?? "").length).toBeGreaterThanOrEqual(8);
  });

  it("disables the button while the order is being placed", async () => {
    let release!: (response: Response) => void;
    mockApi((call) => (call.url.endsWith("/pay") ? json(200, { order: orderFixture({ status: "paid" }) }) : (new Promise<Response>((r) => (release = r)) as unknown as Response)));
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    await waitFor(() => expect((placeOrderButton() as HTMLButtonElement).disabled).toBe(true));
    expect(placeOrderButton().textContent).toBe("Placing order…");
    release(json(201, { order: orderFixture() }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});

describe("Checkout form: when the server refuses", () => {
  it("says how many are left and corrects the bag when stock ran short", async () => {
    mockApi(() =>
      apiError(409, "insufficient_stock", "Not enough stock for some items.", {
        items: [{ skuId: "golden-hour-serum", requested: 3, available: 1 }],
      })
    );
    const user = setup([serum(3)]);

    await fillIn(user);
    await user.click(placeOrderButton());

    const message = await screen.findByText(/only 1 left/);
    expect(message.textContent).toBe("Golden Hour Serum: only 1 left. We've updated your bag.");
    expect(message.getAttribute("role")).toBe("alert");
    expect(savedBag()[0].quantity).toBe(1);
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect((placeOrderButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("takes an item out of the bag when it has just sold out", async () => {
    mockApi(() =>
      apiError(409, "insufficient_stock", "Not enough stock for some items.", {
        items: [{ skuId: "golden-hour-serum", requested: 1, available: 0 }],
      })
    );
    const user = setup([serum(1), dawn(1)]);

    await fillIn(user);
    await user.click(placeOrderButton());

    expect((await screen.findByText(/has just sold out/)).textContent).toContain("Golden Hour Serum");
    expect(savedBag().map((i: { id: string }) => i.id)).toEqual(["dawn-cleanse"]);
  });

  it("shows a field problem under its field and focuses it", async () => {
    mockApi(() =>
      apiError(400, "validation_error", "Some fields are missing or invalid.", [
        { path: "address.postalCode", message: "Too small" },
      ])
    );
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    expect(await screen.findByText("Please check the highlighted fields.")).toBeTruthy();
    expect(screen.getByText("Enter your postal code.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Postal code"));
    expect(screen.getByLabelText("Postal code").getAttribute("aria-invalid")).toBe("true");
  });

  it("passes on the server's own words when an order cannot be paid", async () => {
    mockApi((call) =>
      call.url.endsWith("/pay")
        ? apiError(409, "reservation_expired", "Your items were held for too long.")
        : json(201, { order: orderFixture() })
    );
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());

    expect(await screen.findByText("Your items were held for too long.")).toBeTruthy();
    expect(savedBag()).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("Checkout form: retrying safely", () => {
  it("reuses the same idempotency key after a dropped connection", async () => {
    let attempt = 0;
    const calls = mockApi((call) => {
      if (call.url.endsWith("/pay")) return json(200, { order: orderFixture({ status: "paid" }) });
      attempt += 1;
      return attempt === 1 ? new TypeError("Failed to fetch") : json(201, { order: orderFixture() });
    });
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());
    expect(await screen.findByText(/Could not reach the store/)).toBeTruthy();

    await user.click(placeOrderButton());
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const keys = calls.filter((c) => c.url === "/api/orders").map((c) => c.headers.get("idempotency-key"));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("starts a fresh attempt once the shopper changes something", async () => {
    const calls = mockApi(() => new TypeError("Failed to fetch"));
    const user = setup();

    await fillIn(user);
    await user.click(placeOrderButton());
    await screen.findByText(/Could not reach the store/);

    await user.type(screen.getByLabelText("City"), "!");
    await user.click(placeOrderButton());
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls[0]!.headers.get("idempotency-key")).not.toBe(calls[1]!.headers.get("idempotency-key"));
  });

  it("starts a fresh attempt after a refusal that changes the bag", async () => {
    const calls = mockApi(() =>
      apiError(409, "insufficient_stock", "Not enough stock for some items.", {
        items: [{ skuId: "golden-hour-serum", requested: 3, available: 1 }],
      })
    );
    const user = setup([serum(3)]);

    await fillIn(user);
    await user.click(placeOrderButton());
    await screen.findByText(/only 1 left/);
    await user.click(placeOrderButton());
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls[0]!.headers.get("idempotency-key")).not.toBe(calls[1]!.headers.get("idempotency-key"));
    expect((calls[1]!.body!.items as { quantity: number }[])[0]!.quantity).toBe(1);
  });
});
