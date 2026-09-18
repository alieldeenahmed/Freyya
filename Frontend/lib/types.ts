export type ProductCategory =
  | "Cleanser"
  | "Serum"
  | "Moisturizer"
  | "SPF"
  | "Lip Balm"
  | "Highlighter";

export type Undertone = "cool" | "warm" | "neutral";
export type Intensity = "subtle" | "bold";

export interface ProductVariant {
  id: string;
  name: string;
  hex: string;
  image: string;
  undertone: Undertone;
  intensity: Intensity;
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
  image: string;
  showcase?: string[];
  isHero?: boolean;
  variants?: ProductVariant[];
}
