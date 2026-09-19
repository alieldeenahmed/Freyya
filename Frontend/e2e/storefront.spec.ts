import { expect, test } from "@playwright/test";

test.describe("Browsing the storefront", () => {
  test("the home page tells the brand story and leads to the shop", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Your skin, but better." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Golden Hour Serum" })).toBeAttached();

    await page.getByRole("banner").getByRole("link", { name: "Shop" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();
  });

  test("filters and sorts the shop, and keeps the choice in the address", async ({ page }) => {
    // Product names repeat in the footer, so look only at the page content.
    const products = page.getByRole("main").getByRole("heading", { level: 2 });

    await page.goto("/shop");
    await expect(products).toHaveCount(6);

    await page.getByRole("button", { name: "Color", exact: true }).click();
    await expect(page).toHaveURL(/group=color/);
    await expect(products).toHaveText(["Freyya Balm", "Dew Drops"]);
    // The bag's announcers are status regions too, so pick the count by its text.
    await expect(page.getByRole("status").filter({ hasText: "products" })).toHaveText("2 products");

    await page.getByRole("button", { name: /Sort by/ }).click();
    await page.getByRole("option", { name: "Price: high to low" }).click();
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(products).toHaveText(["Dew Drops", "Freyya Balm"]);

    await page.reload();
    await expect(page.getByRole("button", { name: "Color", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(products).toHaveText(["Dew Drops", "Freyya Balm"]);
  });

  test("opens a product and switches shade", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("main").getByRole("link", { name: /Freyya Balm/ }).click();

    await expect(page).toHaveURL(/\/shop\/freyya-balm$/);
    await expect(page.getByRole("button", { name: "Bare" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Terracotta" }).click();
    await expect(page.getByRole("button", { name: "Terracotta" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Shade — Terracotta")).toBeVisible();
    await expect(page.getByText("Only 2 left")).toBeVisible();
  });

  test("an unknown product is a proper 404 page", async ({ page }) => {
    const response = await page.goto("/shop/not-a-product");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This page isn't here." })).toBeVisible();
  });
});

test.describe("The bag", () => {
  test("adds a shade, shows it in the drawer, and remembers it after a reload", async ({ page }) => {
    await page.goto("/shop/freyya-balm");
    await page.getByRole("button", { name: "Petal" }).click();
    await page.getByRole("button", { name: "Add to bag" }).click();

    const cart = page.getByRole("button", { name: /^Cart(,|$)/ });
    await expect(cart).toContainText("1");
    await expect(cart).toHaveAccessibleName("Cart, 1 item");
    // Seen on screen, and said aloud through a live region that was already on the page.
    await expect(page.getByText("Added to your bag", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "added to your bag" })).toHaveText(
      "Freyya Balm, Petal, added to your bag."
    );

    await cart.click();
    const drawer = page.getByRole("dialog", { name: "Your bag" });
    await expect(drawer).toBeInViewport();
    await expect(drawer).toContainText("Freyya Balm");
    await expect(drawer).toContainText("Petal");

    await page.keyboard.press("Escape");
    // Closed means slid off-screen and removed from the accessibility tree.
    await expect(drawer).not.toBeInViewport();
    await expect(drawer).toHaveAttribute("inert", "");
    await expect(cart).toBeFocused();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Cart(,|$)/ })).toContainText("1");
  });

  test("changes quantities up to the stock limit", async ({ page }) => {
    await page.goto("/shop/golden-hour-serum");
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.getByRole("button", { name: /^Cart(,|$)/ }).click();

    const drawer = page.getByRole("dialog", { name: "Your bag" });
    const more = drawer.getByRole("button", { name: "Increase quantity of Golden Hour Serum" });
    await more.click();
    await more.click();

    await expect(drawer.getByText("Maximum available")).toBeVisible();
    await expect(more).toBeDisabled();

    await drawer.getByRole("button", { name: "Remove Golden Hour Serum from bag" }).click();
    await expect(drawer.getByText("Your bag is empty.")).toBeVisible();
  });
});

test.describe("Shade Match", () => {
  test("takes five answers and recommends a shade", async ({ page }) => {
    await page.goto("/quiz");

    for (const answer of [
      "Freyya Balm — tinted lip balm",
      "Blue or purple",
      "Silver or platinum",
      "Burns before it tans",
      "Barely there",
    ]) {
      await page.getByRole("button", { name: answer }).click();
    }

    await expect(page.getByRole("heading", { level: 1, name: "Petal" })).toBeVisible();
    await page.getByRole("link", { name: "Shop Freyya Balm" }).click();
    await expect(page).toHaveURL(/\/shop\/freyya-balm$/);
  });
});
