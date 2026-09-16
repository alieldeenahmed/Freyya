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
