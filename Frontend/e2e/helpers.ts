import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E } from "./env";

interface Line {
  skuId: string;
  quantity: number;
}

export const orderPayload = (items: Line[], email = "e2e.buyer@example.com") => ({
  email,
  name: "Eli Buyer",
  address: { line1: "1 Test Street", city: "Cairo", postalCode: "11511", country: "Egypt" },
  shippingId: "standard",
  items,
});

// Orders made straight through the API, for tests that are about something else.
export async function createOrder(request: APIRequestContext, items: Line[], email?: string) {
  const res = await request.post(`${E2E.apiUrl}/orders`, { data: orderPayload(items, email) });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).order as { id: string; email: string };
}

export async function createPaidOrder(request: APIRequestContext, items: Line[], email?: string) {
  const order = await createOrder(request, items, email);
  const res = await request.post(`${E2E.apiUrl}/orders/${order.id}/pay`, { data: { email: order.email } });
  expect(res.status(), await res.text()).toBe(200);
  return order;
}

// Stock of one item, read from the public catalog.
export async function stockOf(request: APIRequestContext, skuId: string): Promise<number> {
  const res = await request.get(`${E2E.apiUrl}/products`);
  const { products } = await res.json();
  for (const product of products) {
    if (product.variants) {
      for (const variant of product.variants) {
        if (`${product.id}:${variant.id}` === skuId) return variant.stock;
      }
    } else if (product.id === skuId) {
      return product.stock;
    }
  }
  throw new Error(`No item ${skuId} in the catalog`);
}

export async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E.adminEmail);
  await page.getByLabel("Password").fill(E2E.adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

// Puts a bag in localStorage before the page loads.
export async function seedBag(page: Page, lines: { id: string; productId: string; quantity: number; variantId?: string }[]) {
  await page.addInitScript((bag) => {
    if (!window.localStorage.getItem("freyya:cart")) {
      window.localStorage.setItem("freyya:cart", JSON.stringify(bag));
    }
  }, lines);
}

export async function fillCheckout(page: Page, name = "Sara Nasser", email = "sara@example.com") {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Address").fill("12 Nile Corniche");
  await page.getByLabel("City").fill("Cairo");
  await page.getByLabel("Postal code").fill("11511");
}
