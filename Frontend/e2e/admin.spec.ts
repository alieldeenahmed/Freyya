import { expect, test } from "@playwright/test";
import { E2E } from "./env";
import { createOrder, createPaidOrder, signIn, stockOf } from "./helpers";

test.describe("Admin: signing in", () => {
  test("keeps anonymous visitors out of every admin page and the admin API", async ({ page, request }) => {
    for (const path of ["/admin", "/admin/orders", "/admin/inventory"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    expect((await request.get(`${E2E.apiUrl}/admin/orders`)).status()).toBe(401);
  });

  test("refuses a wrong password and accepts the right one", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(E2E.adminEmail);
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Next also keeps an empty role=alert for route changes, so pick ours by its text.
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("Email or password is incorrect.");

    await page.getByLabel("Password").fill(E2E.adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });

  test("shows the admin without the storefront's header, footer or bag", async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cart(,|$)/ })).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test("signs out, and the session is gone", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("Admin: orders", () => {
  test("finds an order, ships it, and stops offering to cancel it", async ({ page, request }) => {
    const order = await createPaidOrder(request, [{ skuId: "second-skin-cream", quantity: 1 }], "e2e.ship@example.com");
    await signIn(page);

    await page.goto("/admin/orders");
    await page.getByLabel("Search").fill("e2e.ship@example.com");
    await page.getByRole("button", { name: "Find" }).click();
    await page.getByRole("row", { name: new RegExp(order.id) }).getByRole("link", { name: order.id }).click();

    await expect(page.getByRole("heading", { level: 1, name: order.id })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();

    await page.getByRole("button", { name: "Mark as shipped" }).click();

    await expect(page.getByRole("button", { name: "Mark as delivered" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: /^Shipped/ })).not.toContainText("—");
  });

  test("filters the list by status", async ({ page, request }) => {
    const order = await createOrder(request, [{ skuId: "veil-spf", quantity: 1 }], "e2e.pending@example.com");
    await signIn(page);

    await page.goto("/admin/orders?status=pending_payment");

    await expect(page.getByRole("link", { name: order.id })).toBeVisible();
    await expect(page.getByRole("link", { name: /Awaiting payment/ })).toHaveAttribute("aria-current", "page");
  });

  test("cancelling an order puts its stock back", async ({ page, request }) => {
    const before = await stockOf(request, "veil-spf");
    const order = await createOrder(request, [{ skuId: "veil-spf", quantity: 2 }], "e2e.cancel@example.com");
    expect(await stockOf(request, "veil-spf")).toBe(before - 2);

    await signIn(page);
    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("put its items back in stock");
    await page.getByRole("button", { name: "Yes, continue" }).click();

    await expect(page.getByText("This order is closed. No further steps.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Items" })).toContainText("Cancelled");
    expect(await stockOf(request, "veil-spf")).toBe(before);
  });
});

test.describe("Admin: inventory", () => {
  test("restocks an item and records why", async ({ page, request }) => {
    const before = await stockOf(request, "second-skin-cream");
    await signIn(page);
    await page.goto("/admin/inventory");

    const row = page.getByRole("row").filter({ hasText: "Second Skin Cream" });
    await row.getByRole("button", { name: "Adjust" }).click();
    await page.getByLabel("Change").fill("5");
    await page.getByLabel("Note").fill("E2E restock");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText(String(before + 5));
    expect(await stockOf(request, "second-skin-cream")).toBe(before + 5);

    await row.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Second Skin Cream" }).locator("xpath=following-sibling::tr[1]")).toContainText("E2E restock");
  });

  test("refuses to take stock below zero", async ({ page, request }) => {
    const before = await stockOf(request, "golden-hour-serum");
    await signIn(page);
    await page.goto("/admin/inventory");

    await page.getByRole("row").filter({ hasText: "Golden Hour Serum" }).getByRole("button", { name: "Adjust" }).click();
    await page.getByLabel("Change").fill(String(-(before + 50)));
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "below zero" })).toHaveText("That would take stock below zero.");
    expect(await stockOf(request, "golden-hour-serum")).toBe(before);
  });
});
