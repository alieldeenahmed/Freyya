import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createPaidOrder, seedBag, signIn } from "./helpers";

// Automated scans catch a real share of accessibility problems, such as missing names, bad
// roles, broken ARIA references and low contrast. They do not replace testing with a
// screen reader and a keyboard, so they are one layer of the accessibility work, not all of it.
test.use({ reducedMotion: "reduce" });

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();

  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n   ")}`
  );
  expect(summary, `${label} has accessibility violations`).toEqual([]);
}

test.describe("The scanner itself", () => {
  test("reports real problems, so a clean result means something", async ({ page }) => {
    await page.setContent(
      '<html lang="en"><head><title>t</title></head><body><main><img src="x.png"><button></button></main></body></html>'
    );
    const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();

    expect(violations.map((v) => v.id)).toEqual(expect.arrayContaining(["image-alt", "button-name"]));
  });
});

test.describe("Automated accessibility scans: storefront", () => {
  for (const [name, path] of [
    ["home", "/"],
    ["shop", "/shop"],
    ["product with shades", "/shop/freyya-balm"],
    ["product without shades", "/shop/golden-hour-serum"],
    ["Shade Match", "/quiz"],
    ["about", "/about"],
    ["contact", "/contact"],
    ["shipping and returns", "/shipping-returns"],
    ["privacy", "/privacy"],
    ["terms", "/terms"],
    ["empty checkout", "/checkout"],
    ["not found", "/not-a-page"],
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await expectNoViolations(page, name);
    });
  }

  test("checkout with items and errors showing", async ({ page }) => {
    await seedBag(page, [{ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 }]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await expectNoViolations(page, "checkout with errors");
  });

  test("the bag drawer, open with items in it", async ({ page }) => {
    await seedBag(page, [{ id: "freyya-balm:petal", productId: "freyya-balm", variantId: "petal", quantity: 2 }]);
    await page.goto("/");
    await page.getByRole("button", { name: /^Cart(,|$)/ }).click();
    await expect(page.getByRole("dialog", { name: "Your bag" })).toBeInViewport();

    await expectNoViolations(page, "open bag drawer");
  });

  test("an open dropdown on the shop", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: /Sort by/ }).click();
    await expect(page.getByRole("listbox")).toBeVisible();

    await expectNoViolations(page, "open sort menu");
  });

  test("the review form", async ({ page }) => {
    await page.goto("/shop/freyya-balm");
    await page.getByRole("button", { name: "Write a review" }).click();
    await expect(page.getByRole("form", { name: "Write a review" })).toBeVisible();

    await expectNoViolations(page, "review form");
  });

  test("a Shade Match result", async ({ page }) => {
    await page.goto("/quiz");
    for (const answer of ["Dew Drops — glow drops", "Green", "Gold", "Tans easily, rarely burns", "Noticeable"]) {
      await page.getByRole("button", { name: answer }).click();
    }
    await expect(page.getByRole("heading", { level: 1, name: "Bronze" })).toBeVisible();

    await expectNoViolations(page, "quiz result");
  });
});

test.describe("Automated accessibility scans: admin", () => {
  test("sign in", async ({ page }) => {
    await page.goto("/admin/login");
    await expectNoViolations(page, "admin sign in");
  });

  test("the signed-in pages", async ({ page, request }) => {
    const order = await createPaidOrder(request, [{ skuId: "dew-drops:moonlight", quantity: 1 }], "e2e.a11y@example.com");
    await signIn(page);

    for (const [name, path] of [
      ["overview", "/admin"],
      ["orders", "/admin/orders"],
      ["an order", `/admin/orders/${order.id}`],
      ["inventory", "/admin/inventory"],
    ] as const) {
      await page.goto(path);
      await expectNoViolations(page, `admin ${name}`);
    }
  });

  test("the stock adjustment form", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/inventory");
    await page.getByRole("row").filter({ hasText: "Dawn Cleanse" }).getByRole("button", { name: "Adjust" }).click();
    await expect(page.getByLabel("Change")).toBeVisible();

    await expectNoViolations(page, "adjust stock form");
  });
});
