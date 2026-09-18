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
  stock: number;
  undertone: Undertone;
  intensity: Intensity;
}

export interface ProductDetails {
  ingredients: string;
  skinTypes: string[];
  size: string;
  usage: string;
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
  details: ProductDetails;
  related: string[];
  // Products with shades track stock on each variant instead.
  stock?: number;
  showcase?: string[];
  isHero?: boolean;
  variants?: ProductVariant[];
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  variant?: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
