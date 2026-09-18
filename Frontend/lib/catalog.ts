import { products as snapshot } from "@/data/products";
import type { Product } from "@/lib/types";

export const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

// Stock changes with every order, so the catalog is refreshed often. A shopper who sees
// a slightly old count is still protected: checkout checks stock again on the server.
const REVALIDATE_SECONDS = 30;

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.price === "number" &&
    typeof p.image === "string" &&
    typeof p.details === "object" &&
    Array.isArray(p.related)
  );
}

// If the API can't be reached the storefront still works from the bundled snapshot,
// so pages stay browsable. Orders will fail until the API is back.
export async function getCatalog(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/products`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["catalog"] },
    });
    if (!res.ok) throw new Error(`API answered ${res.status}`);

    const body = (await res.json()) as { products?: unknown };
    if (!Array.isArray(body.products) || body.products.length === 0 || !body.products.every(isProduct)) {
      throw new Error("API returned an unexpected catalog");
    }
    return body.products;
  } catch (error) {
    console.warn(`[catalog] using the bundled snapshot: ${(error as Error).message}`);
    return snapshot;
  }
}
