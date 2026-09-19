import { expect, test } from "@playwright/test";
import { seedBag, signIn } from "./helpers";

// These run on a 375 pixel wide phone (see the "mobile" project in playwright.config.ts).

const PAGES = [
  "/",
  "/shop",
  "/shop/golden-hour-serum",
  "/shop/freyya-balm",
  "/quiz",
  "/about",
  "/contact",
  "/shipping-returns",
  "/privacy",
];

const overflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("On a phone", () => {
  for (const path of PAGES) {
    test(`${path} fits the screen without sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(await overflow(page)).toBeLessThanOrEqual(1);
    });
  }

  test("the menu button opens the navigation, which then leads somewhere", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open menu" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    await menu.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("banner").getByRole("link", { name: "Shade Match" }).click();
    await expect(page).toHaveURL(/\/quiz$/);
  });

  test("the product page stacks the photograph above the details", async ({ page }) => {
    await page.goto("/shop/golden-hour-serum");

    const photo = await page.getByRole("img", { name: "Golden Hour Serum" }).first().boundingBox();
    const heading = await page.getByRole("heading", { level: 1, name: "Golden Hour Serum" }).boundingBox();

    expect(photo!.y + photo!.height).toBeLessThanOrEqual(heading!.y + 1);
    expect(photo!.width).toBeGreaterThan(300);
  });

  test("the shop shows one product per row", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const cards = page.getByRole("main").getByRole("link").filter({ has: page.getByRole("heading", { level: 2 }) });
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();

    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
  });

  test("the bag drawer fits the screen", async ({ page }) => {
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);
    await page.goto("/");

    await page.getByRole("button", { name: "Cart", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Your bag" });
    // Wait for the slide-in to finish before measuring.
    await expect(drawer).toBeInViewport({ ratio: 0.99 });

    const box = await drawer.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(376);
  });

  test("checkout puts the form first and the summary below it", async ({ page }) => {
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);
    await page.goto("/checkout");

    const form = await page.getByRole("form", { name: "Checkout" }).boundingBox();
    const summary = await page.getByRole("complementary", { name: "Order summary" }).boundingBox();

    expect(summary!.y).toBeGreaterThan(form!.y + form!.height - 1);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });

  test("the admin fits the screen too", async ({ page }) => {
    await signIn(page);

    for (const path of ["/admin", "/admin/orders", "/admin/inventory"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await overflow(page), path).toBeLessThanOrEqual(1);
    }
  });
});
