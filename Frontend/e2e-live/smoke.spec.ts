import { expect, test } from "@playwright/test";

// Read-only. Run against the deployed demo (see playwright.live.config.ts).

const EMAIL = process.env.DEMO_ADMIN_EMAIL;
const PASSWORD = process.env.DEMO_ADMIN_PASSWORD;

test.describe("The storefront", () => {
  test("opens, and says it is a demo", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-demo-banner]").first()).toContainText("Demo store");
  });

  test("shows products that came from the API, not the fallback snapshot", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator("body")).toHaveAttribute("data-catalog", "live");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(6);
  });

  test("answers its own health check through the rewrite", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("lets a visitor put something in the bag and reach checkout, without ordering", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("button", { name: /^Cart, 1 item/ })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByRole("form", { name: "Checkout" })).toBeVisible();
    await expect(page.locator("[data-demo-helper]")).toContainText("made-up details");
    await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
    // The checkout is real, and the page does not claim the demo cannot order.
    await expect(page.getByText("can't reach its API")).toHaveCount(0);
  });
});

test.describe("The admin", () => {
  test("keeps anonymous visitors out", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("lets the demo admin sign in, look around and sign out", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD are not set");

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
