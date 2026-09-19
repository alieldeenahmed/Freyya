import { expect, test } from "@playwright/test";
import { E2E } from "./env";
import { fillCheckout, seedBag, stockOf } from "./helpers";

const placeOrder = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /Place order/ });

test.describe("Checkout", () => {
  test("buys a product end to end", async ({ page, request }) => {
    const stockBefore = await stockOf(request, "dawn-cleanse");

    await page.goto("/shop/dawn-cleanse");
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.getByRole("button", { name: "Cart", exact: true }).click();
    await page.getByRole("dialog", { name: "Your bag" }).getByRole("link", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await fillCheckout(page);
    await page.locator("#checkout-country").click();
    await page.getByRole("option", { name: "Egypt" }).click();
    await placeOrder(page).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, Sara." })).toBeVisible();
    const orderId = (await page.getByRole("main").innerText()).match(/FRY-[A-Z2-9]{7}/)?.[0];
    expect(orderId).toBeTruthy();

    // What the shopper saw is what the API recorded.
    const res = await request.get(`${E2E.apiUrl}/orders/${orderId}?email=sara@example.com`);
    const { order } = await res.json();
    expect(order).toMatchObject({ status: "paid", totals: { subtotal: 28, shipping: 6, total: 34 } });
    expect(order.items).toMatchObject([{ id: "dawn-cleanse", quantity: 1 }]);
    expect(await stockOf(request, "dawn-cleanse")).toBe(stockBefore - 1);

    // The bag is empty, and the confirmation survives a refresh.
    await expect(page.getByRole("button", { name: "Cart", exact: true })).not.toContainText("1");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, Sara." })).toBeVisible();
  });

  test("explains a refused order and corrects the bag", async ({ page }) => {
    await seedBag(page, [{ id: "golden-hour-serum", productId: "golden-hour-serum", quantity: 3 }]);
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "insufficient_stock",
            message: "Not enough stock for some items.",
            details: { items: [{ skuId: "golden-hour-serum", requested: 3, available: 1 }] },
          },
        }),
      });
    });

    await page.goto("/checkout");
    await fillCheckout(page);
    await placeOrder(page).click();

    await expect(page.getByRole("alert").filter({ hasText: "only 1 left" })).toHaveText(
      "Golden Hour Serum: only 1 left. We've updated your bag."
    );
    await expect(page).toHaveURL(/\/checkout$/);
    const quantity = await page.evaluate(() => JSON.parse(localStorage.getItem("freyya:cart")!)[0].quantity);
    expect(quantity).toBe(1);
    await expect(placeOrder(page)).toBeEnabled();
  });

  test("asks for every missing detail before sending anything", async ({ page }) => {
    let sent = false;
    await page.route("**/api/orders", (route) => {
      sent = true;
      return route.abort();
    });
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);

    await page.goto("/checkout");
    await placeOrder(page).click();

    await expect(page.getByRole("form", { name: "Checkout" }).getByRole("alert")).toHaveText([
      "Enter a valid email address.",
      "Enter your full name.",
      "Enter your street address.",
      "Enter your city.",
      "Enter your postal code.",
    ]);
    await expect(page.getByLabel("Email")).toBeFocused();
    expect(sent).toBe(false);
  });

  test("shows the shipping cost in the button and the summary", async ({ page }) => {
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);
    await page.goto("/checkout");

    await expect(placeOrder(page)).toHaveText("Place order · $34");
    // The radio is a hidden input inside a card, so click the card as a shopper would.
    await page.locator("label").filter({ hasText: "Express" }).click();
    await expect(placeOrder(page)).toHaveText("Place order · $42");
  });

  test("says so when there is nothing to buy", async ({ page }) => {
    await page.goto("/checkout");

    await expect(page.getByText(/Your bag is empty/)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Shop all" })).toBeVisible();
  });

  test("sends someone with no order back to the shop from the confirmation page", async ({ page }) => {
    await page.goto("/checkout/confirmation");

    await expect(page).toHaveURL(/\/shop$/);
  });
});
