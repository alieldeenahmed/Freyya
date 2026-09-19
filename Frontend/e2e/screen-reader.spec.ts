import { expect, test } from "@playwright/test";
import { seedBag } from "./helpers";

// These check what a screen reader is given (names, roles, states) and where focus goes, in a
// real browser. The accessibility tree they read is the one NVDA and VoiceOver are built on.
// They do not replace listening to the site with one: see docs/accessibility-testing.md.
test.use({ reducedMotion: "reduce" });

test.describe("Names and states in the accessibility tree", () => {
  test("the shade swatches are one named group, and say which is chosen", async ({ page }) => {
    await page.goto("/shop/freyya-balm");

    const group = page.getByRole("group", { name: /^Shade/ });
    await expect(group).toMatchAriaSnapshot(`
      - group "Shade — Bare":
        - button "Bare" [pressed]
        - button "Petal"
        - button "Rosewood"
        - button "Terracotta"
    `);

    await page.getByRole("button", { name: "Petal" }).click();
    await expect(page.getByRole("group", { name: "Shade — Petal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Petal" })).toHaveAttribute("aria-pressed", "true");
    // The bag's own announcer is also a status region, so pick the stock line by its text.
    await expect(page.getByRole("status").filter({ hasText: /left|in stock/ })).toHaveText("Only 4 left");
  });

  test("only the shade that is showing has its photograph exposed", async ({ page }) => {
    await page.goto("/shop/freyya-balm");

    await expect(page.getByRole("img", { name: /^Freyya Balm in / })).toHaveCount(1);
    await expect(page.getByRole("img", { name: "Freyya Balm in Bare" })).toBeVisible();

    await page.getByRole("button", { name: "Rosewood" }).click();
    await expect(page.getByRole("img", { name: "Freyya Balm in Rosewood" })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Freyya Balm in / })).toHaveCount(1);
  });

  test("a product card is named once, not by its photograph as well", async ({ page }) => {
    await page.goto("/shop");

    const card = page.getByRole("main").getByRole("link", { name: /Dawn Cleanse/ });
    await expect(card).toHaveCount(1);
    await expect(card).not.toHaveAccessibleName(/Dawn Cleanse.*Dawn Cleanse/);
    await expect(card).toHaveAccessibleName(/\$\d+$/);
  });

  test("each accordion panel is named by its button, and closed ones are made inert", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");

    // Playwright's role queries ignore `inert`, so read the attribute the browser acts on.
    const ingredients = page.getByRole("region", { name: "Ingredients" });
    const usage = page.getByRole("region", { name: "Usage" });
    await expect(ingredients).not.toHaveAttribute("inert");
    await expect(usage).toHaveAttribute("inert", "");

    await page.getByRole("button", { name: "Usage" }).click();
    await expect(usage).not.toHaveAttribute("inert");
  });

  test("the rating breakdown reads as sentences", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");

    const rows = page.getByRole("list", { name: "Rating breakdown" }).getByRole("listitem");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText(/\d+ reviews? with 5 stars/);
    await expect(rows.last()).toContainText(/\d+ reviews? with 1 star/);
  });

  test("the page has one main landmark and named navigations", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    for (const name of ["Explore", "Help", "Products"]) {
      await expect(page.getByRole("navigation", { name })).toHaveCount(1);
    }
  });
});

test.describe("Keyboard and focus", () => {
  test("the skip link is the first stop, and lands in the main content", async ({ page }) => {
    await page.goto("/about");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("Shade Match puts focus on each new question and on the result", async ({ page }) => {
    await page.goto("/quiz");

    await page.getByRole("button", { name: "Dew Drops — glow drops" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Look at your wrist. What color are your veins?");

    for (const answer of ["Green", "Gold", "Tans easily, rarely burns", "Noticeable"]) {
      await page.getByRole("button", { name: answer }).click();
    }
    await expect(page.getByRole("heading", { level: 1, name: "Bronze" })).toBeFocused();
  });

  test("removing from the bag keeps focus in the drawer and says what happened", async ({ page }) => {
    await seedBag(page, [
      { id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 },
      { id: "veil-spf", productId: "veil-spf", quantity: 1 },
    ]);
    await page.goto("/");
    await page.getByRole("button", { name: /^Cart(,|$)/ }).click();
    const drawer = page.getByRole("dialog", { name: "Your bag" });
    await expect(drawer).toBeInViewport();

    await drawer.getByRole("button", { name: "Remove Dawn Cleanse from bag" }).click();

    await expect(drawer.getByRole("status")).toHaveText("Dawn Cleanse removed from your bag.");
    await expect(drawer.getByRole("button", { name: "Remove Veil SPF from bag" })).toBeFocused();

    await drawer.getByRole("button", { name: "Remove Veil SPF from bag" }).click();
    await expect(drawer.getByRole("button", { name: "Close cart" })).toBeFocused();
  });

  test("the star rating moves focus with the arrow keys", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");
    await page.getByRole("button", { name: "Write a review" }).click();

    await expect(page.getByRole("radio", { name: "1 star" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "3 stars" })).toBeFocused();
    await expect(page.getByRole("radio", { name: "3 stars" })).toBeChecked();
  });

  test("a mistake in the review form sends focus to it and is described", async ({ page }) => {
    await page.goto("/shop/dawn-cleanse");
    await page.getByRole("button", { name: "Write a review" }).click();
    await page.getByRole("radio", { name: "4 stars" }).click();

    await page.getByRole("button", { name: "Submit review" }).click();

    const title = page.getByLabel("Title");
    await expect(title).toBeFocused();
    await expect(title).toHaveAccessibleDescription("Give your review a short title.");
    await expect(title).toHaveAttribute("aria-invalid", "true");
  });

  test("sending the contact form moves focus to the thank-you", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Name").fill("Sara Ali");
    await page.getByLabel("Email").fill("sara@example.com");
    await page.getByLabel("Message").fill("Is the balm vegan?");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toBeFocused();
  });
});
