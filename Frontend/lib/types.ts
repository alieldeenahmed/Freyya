export type ProductCategory =
  | "Cleanser"
  | "Serum"
  | "Moisturizer"
  | "SPF"
  | "Lip Balm"
  | "Highlighter";

export type Undertone = "cool" | "warm" | "neutral";

export interface ProductVariant {
  id: string;
  name: string;
  hex: string;
  undertone: Undertone;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  tagline: string;
  description: string;
  price: number;
  specs: string[];
  color: string;
  isHero?: boolean;
  variants?: ProductVariant[];
}
