import { products } from "@/data/products";
import type { Product, ProductCategory } from "@/lib/types";

export function getAllProducts(): Product[] {
  return products;
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getHeroProduct(): Product | undefined {
  return products.find((product) => product.isHero);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return products.filter((product) => product.category === category);
}

export function getVariant(productId: string, variantId: string) {
  return getProductById(productId)?.variants?.find(
    (variant) => variant.id === variantId
  );
}

export function getRelatedProducts(productId: string): Product[] {
  const product = getProductById(productId);
  if (!product) return [];

  return product.related
    .map((id) => getProductById(id))
    .filter((related): related is Product => Boolean(related));
}

export function getStock(product: Product, variantId?: string): number {
  if (product.variants) {
    return product.variants.find((v) => v.id === variantId)?.stock ?? 0;
  }
  return product.stock ?? 0;
}
