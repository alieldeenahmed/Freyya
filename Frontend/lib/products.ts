import type { Product } from "@/lib/types";

// Helpers over a list of products. The list itself comes from the API (lib/catalog.ts
// on the server, useCatalog() in the browser).

export function findProduct(products: Product[], id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getRelatedProducts(products: Product[], productId: string): Product[] {
  const product = findProduct(products, productId);
  if (!product) return [];

  return product.related
    .map((id) => findProduct(products, id))
    .filter((related): related is Product => Boolean(related));
}

export function getStock(product: Product, variantId?: string): number {
  if (product.variants) {
    return product.variants.find((v) => v.id === variantId)?.stock ?? 0;
  }
  return product.stock ?? 0;
}

export function isInStock(product: Product): boolean {
  if (product.variants) return product.variants.some((v) => v.stock > 0);
  return (product.stock ?? 0) > 0;
}
