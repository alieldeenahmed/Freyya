import { expect, test } from "@playwright/test";
import { createPaidOrder, seedBag, signIn } from "./helpers";

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

  test("Escape closes the menu and puts focus back on its button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    await page.keyboard.press("Escape");

    const menu = page.getByRole("button", { name: "Open menu" });
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
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

    await page.getByRole("button", { name: /^Cart(,|$)/ }).click();
    const drawer = page.getByRole("dialog", { name: "Your bag" });
    // The panel slides in, so keep measuring until it has settled.
    const edges = async () => {
      const box = await drawer.boundingBox();
      return [box!.x, box!.x + box!.width];
    };
    await expect.poll(async () => (await edges())[0]).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => (await edges())[1]).toBeLessThanOrEqual(376);
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

// The same checks from a narrow phone to a large desktop, since the layout only has a few
// breakpoints and each of them has to hold up.
test.describe("From a narrow phone to a large desktop", () => {
  for (const width of [320, 768, 1024, 1920]) {
    test(`no page scrolls sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 2 }]);

      for (const path of [...PAGES, "/checkout", "/not-a-page"]) {
        await page.goto(path);
        expect(await overflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("the bag drawer fits a 320 pixel screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 2 }]);
    await page.goto("/");
    await page.getByRole("button", { name: /^Cart(,|$)/ }).click();

    const drawer = page.getByRole("dialog", { name: "Your bag" });
    await expect.poll(async () => (await drawer.boundingBox())!.x + (await drawer.boundingBox())!.width).toBeLessThanOrEqual(321);
    await expect(drawer.getByRole("link", { name: "Checkout" })).toBeInViewport();
  });
});

test.describe("Controls that are big enough to tap on a phone", () => {
  const box = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!;
  const bigEnough = async (locator: import("@playwright/test").Locator, label: string) => {
    const b = await box(locator);
    expect(b.height, `${label} height`).toBeGreaterThanOrEqual(39.5);
    expect(b.width, `${label} width`).toBeGreaterThanOrEqual(39.5);
  };

  test("the header, the bag and the newsletter", async ({ page }) => {
    await page.goto("/");
    await bigEnough(page.getByRole("button", { name: "Open menu" }), "menu button");
    await bigEnough(page.getByRole("button", { name: /^Cart(,|$)/ }), "bag button");
    await bigEnough(page.getByRole("button", { name: "Join" }), "newsletter button");
  });

  test("a product page: shade swatches, the rating, the review form and the way back", async ({ page }) => {
    await page.goto("/shop/freyya-balm");
    for (const shade of ["Bare", "Petal", "Rosewood", "Terracotta"]) {
      await bigEnough(page.getByRole("button", { name: shade }), `${shade} swatch`);
    }
    await bigEnough(page.getByRole("button", { name: /Go to reviews/ }), "rating button");
    await bigEnough(page.getByRole("link", { name: "Back to shop" }), "back link");

    await page.getByRole("button", { name: "Write a review" }).click();
    for (const stars of ["1 star", "5 stars"]) await bigEnough(page.getByRole("radio", { name: stars }), stars);
    await bigEnough(page.getByRole("button", { name: "Cancel" }), "cancel button");
    // Five stars and their label fit a narrow screen without pushing the page sideways.
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });

  test("checkout: the way back to the shop", async ({ page }) => {
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);
    await page.goto("/checkout");
    await bigEnough(page.getByRole("link", { name: /Keep shopping/ }), "keep shopping");
  });
});

test.describe("The admin tables on a phone", () => {
  test("an order in the list is a card with everything on screen", async ({ page, request }) => {
    const order = await createPaidOrder(request, [{ skuId: "veil-spf", quantity: 1 }], "e2e.phone@example.com");
    await signIn(page);
    await page.goto("/admin/orders");

    const row = page.getByRole("row").filter({ hasText: order.id });
    await expect(row).toBeVisible();
    const inViewport = async (name: string | RegExp) => {
      const b = (await row.getByText(name).first().boundingBox())!;
      return b.x >= 0 && b.x + b.width <= 376;
    };
    expect(await inViewport(order.id)).toBe(true);
    expect(await inViewport("e2e.phone@example.com")).toBe(true);
    expect(await inViewport(/Paid/)).toBe(true);
    expect(await inViewport(/\$\d/)).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });

  test("inventory buttons are on screen, and still announced as a table", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/inventory");

    const row = page.getByRole("row").filter({ hasText: "Dawn Cleanse" });
    for (const name of [/Adjust/, /History/]) {
      const b = (await row.getByRole("button", { name }).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(376);
      expect(b.height).toBeGreaterThanOrEqual(39.5);
    }
    // Restyling the rows must not take away what a screen reader knows about the table.
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "In stock" })).toHaveCount(1);

    await row.getByRole("button", { name: /Adjust/ }).click();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await row.getByRole("button", { name: /History/ }).click();
    await expect(page.getByRole("list", { name: "Stock history" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });
});
