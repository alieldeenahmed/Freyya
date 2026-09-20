import { expect, test, type Page } from "@playwright/test";
import { E2E } from "./env";
import { createPaidOrder, fillCheckout, seedBag, signIn, stockOf } from "./helpers";

const cartButton = (page: Page) => page.getByRole("button", { name: /^Cart(,|$)/ });
const placeOrder = (page: Page) => page.getByRole("button", { name: /Place order/ });
const drawerOf = (page: Page) => page.getByRole("dialog", { name: "Your bag" });

test.describe("Journey A: from the front door to a confirmed order", () => {
  test("home, shop, product, shade, bag, reload, checkout", async ({ page, request }) => {
    const before = await stockOf(request, "freyya-balm:rosewood");

    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Shop", exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);

    await page.getByRole("main").getByRole("link", { name: /Freyya Balm/ }).first().click();
    await expect(page).toHaveURL(/\/shop\/freyya-balm$/);

    await page.getByRole("button", { name: "Rosewood" }).click();
    await expect(page.getByRole("group", { name: "Shade — Rosewood" })).toBeVisible();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(cartButton(page)).toHaveAccessibleName("Cart, 1 item");

    // The bag survives a reload, and still names the shade.
    await page.reload();
    await expect(cartButton(page)).toHaveAccessibleName("Cart, 1 item");
    await cartButton(page).click();
    await expect(drawerOf(page)).toContainText("Freyya Balm");
    await expect(drawerOf(page)).toContainText("Rosewood");
    await drawerOf(page).getByRole("link", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await fillCheckout(page);
    await placeOrder(page).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, Sara." })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Rosewood");
    expect(await stockOf(request, "freyya-balm:rosewood")).toBe(before - 1);
  });
});

test.describe("Journey B: stock that runs out, and limits on what can be bought", () => {
  test("stops at the stock there is, on the product page and in the drawer", async ({ page }) => {
    await page.goto("/shop/golden-hour-serum");
    await expect(page.getByRole("status").filter({ hasText: /left|in stock/ })).toHaveText("Only 3 left");

    const add = page.getByRole("button", { name: /Add to bag|Added to bag|in your bag/ });
    for (let i = 0; i < 3; i++) await add.click();

    await expect(add).toHaveText("All 3 in your bag", { timeout: 5000 });
    await expect(add).toBeDisabled();

    await cartButton(page).click();
    await expect(drawerOf(page).getByText("Maximum available")).toBeVisible();
    await expect(drawerOf(page).getByRole("button", { name: /Increase quantity/ })).toBeDisabled();
  });

  test("stops at ten of an item, however much is in stock, and says that is the limit", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");
    const add = page.getByRole("button", { name: /Add to bag|Added to bag|in your bag/ });
    for (let i = 0; i < 10; i++) await add.click();

    await expect(add).toHaveText("10 in your bag, the most per order", { timeout: 5000 });
    await expect(add).toBeDisabled();

    await cartButton(page).click();
    await expect(drawerOf(page).getByText("Maximum per order")).toBeVisible();
    await expect(cartButton(page)).toHaveAccessibleName("Cart, 10 items");
  });

  test("cuts back a bag from an earlier visit, and tells the shopper what changed", async ({ page }) => {
    await seedBag(page, [
      { id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 24 },
      { id: "golden-hour-serum", productId: "golden-hour-serum", quantity: 9 },
      { id: "no-longer-sold", productId: "no-longer-sold", quantity: 1 },
    ]);
    await page.goto("/checkout");

    // The bag drawer keeps a copy of the notice too, so look inside the page itself.
    const notice = page.getByRole("main").getByRole("status").filter({ hasText: "Your bag changed" });
    await expect(notice).toContainText("Dawn Cleanse: one order can hold at most 10");
    await expect(notice).toContainText("Golden Hour Serum: only 3 left");
    await expect(notice).toContainText("is no longer available");

    const summary = page.getByRole("complementary", { name: "Order summary" });
    await expect(summary).toContainText("$280"); // ten Dawn Cleanse
    await expect(placeOrder(page)).toContainText("$"); // the button reflects the corrected bag

    await notice.getByRole("button", { name: "Got it" }).click();
    await expect(notice).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("freyya:cart")!));
    expect(saved.map((line: { id: string; quantity: number }) => [line.id, line.quantity])).toEqual([
      ["dawn-cleanse", 10],
      ["golden-hour-serum", 3],
    ]);
  });

  test("meets someone else buying the last units while the shopper is still typing", async ({ page, request }) => {
    // The page holds a catalog up to half a minute old, so it believes there are plenty.
    await seedBag(page, [{ id: "second-skin-cream", productId: "second-skin-cream", quantity: 3 }]);
    await page.goto("/checkout");
    await fillCheckout(page);

    // Meanwhile another shopper takes all but one.
    const stock = await stockOf(request, "second-skin-cream");
    await createPaidOrder(request, [{ skuId: "second-skin-cream", quantity: Math.min(10, stock - 1) }], "e2e.rival@example.com");
    if (stock - 1 > 10) await createPaidOrder(request, [{ skuId: "second-skin-cream", quantity: stock - 1 - 10 }], "e2e.rival2@example.com");
    expect(await stockOf(request, "second-skin-cream")).toBe(1);

    await placeOrder(page).click();

    await expect(page.getByRole("alert").filter({ hasText: "only 1 left" })).toHaveText(
      "Second Skin Cream: only 1 left. We've updated your bag."
    );
    const bag = await page.evaluate(() => JSON.parse(localStorage.getItem("freyya:cart")!));
    expect(bag[0].quantity).toBe(1);
    await expect(placeOrder(page)).toBeEnabled();

    // The shopper accepts, and gets the last one.
    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    expect(await stockOf(request, "second-skin-cream")).toBe(0);
  });
});

test.describe("Journey C: the store fails during checkout, and the shopper recovers", () => {
  const goToCheckout = async (page: Page) => {
    await seedBag(page, [{ id: "veil-spf", productId: "veil-spf", quantity: 1 }]);
    await page.goto("/checkout");
    await fillCheckout(page);
  };

  test("an unreachable store: says so, keeps the bag, and the retry reuses the same request key", async ({ page, request }) => {
    const before = await stockOf(request, "veil-spf");
    await goToCheckout(page);

    const keys: (string | undefined)[] = [];
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      keys.push(route.request().headers()["idempotency-key"]);
      await route.abort("connectionfailed");
    });

    await placeOrder(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not reach the store" })).toBeVisible();
    await expect(placeOrder(page)).toBeEnabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("freyya:cart")!))).toHaveLength(1);

    // The connection comes back.
    await page.unroute("**/api/orders");
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() === "POST") keys.push(route.request().headers()["idempotency-key"]);
      await route.fallback();
    });
    await placeOrder(page).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
    expect(await stockOf(request, "veil-spf")).toBe(before - 1);
  });

  test("a gateway error page: shows a plain message, never the error page itself", async ({ page }) => {
    await goToCheckout(page);
    await page.route("**/api/orders", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<html><h1>502 Bad Gateway</h1></html>" })
        : route.fallback()
    );

    await placeOrder(page).click();

    const alert = page.getByRole("alert").filter({ hasText: "not answering" });
    await expect(alert).toContainText("Your bag is safe");
    await expect(page.getByText("Bad Gateway")).toHaveCount(0);
    await expect(placeOrder(page)).toBeEnabled();

    await page.unroute("**/api/orders");
    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
  });

  test("being rate limited: asks the shopper to wait, then lets them try again", async ({ page }) => {
    await goToCheckout(page);
    await page.route("**/api/orders", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 429,
            contentType: "application/json",
            headers: { "retry-after": "60" },
            body: JSON.stringify({ error: { code: "rate_limited", message: "Rate limit exceeded, retry in 1 minute" } }),
          })
        : route.fallback()
    );

    await placeOrder(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Too many attempts" })).toBeVisible();

    await page.unroute("**/api/orders");
    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
  });

  test("a payment step that fails after the order was made: retrying finishes the same order", async ({ page, request }) => {
    const before = await stockOf(request, "veil-spf");
    await goToCheckout(page);

    let failed = false;
    await page.route("**/api/orders/*/pay", async (route) => {
      if (!failed) {
        failed = true;
        return route.abort("connectionfailed");
      }
      return route.fallback();
    });

    await placeOrder(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not reach the store" })).toBeVisible();
    // The stock is held by the unpaid order.
    expect(await stockOf(request, "veil-spf")).toBe(before - 1);

    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    // One order, so the stock was taken once.
    expect(await stockOf(request, "veil-spf")).toBe(before - 1);
  });
});

test.describe("Journey D: the admin, when the session ends", () => {
  test("sends the admin back to sign in instead of showing an error", async ({ page, request }) => {
    const order = await createPaidOrder(request, [{ skuId: "veil-spf", quantity: 1 }], "e2e.expired@example.com");
    await signIn(page);
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole("button", { name: "Mark as shipped" })).toBeVisible();

    // The session ends while the page is open.
    await page.context().clearCookies();
    await page.getByRole("button", { name: "Mark as shipped" }).click();

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    // Nothing was changed on the way.
    const res = await request.get(`${E2E.apiUrl}/orders/${order.id}?email=e2e.expired@example.com`);
    expect((await res.json()).order.status).toBe("paid");
  });
});
