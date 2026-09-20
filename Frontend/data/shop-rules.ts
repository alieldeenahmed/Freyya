// GENERATED from Backend/src/domain/pricing.ts by `npm run sync:data`. Do not edit by hand.
// The API is the authority. This is a snapshot for when the API cannot be reached, and the
// data the storefront's tests run against.

export type ShippingId = "standard" | "express";

export interface ShippingMethod {
  id: ShippingId;
  label: string;
  eta: string;
  price: number;
  // Standard shipping is free above this subtotal.
  freeOver?: number;
}

export const FREE_SHIPPING_THRESHOLD = 75;

// The most of one item a single order can hold, however many lines it is spread over.
export const MAX_PER_ITEM = 10;

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: "standard", label: "Standard", eta: "3–5 business days", price: 6, freeOver: 75 },
  { id: "express", label: "Express", eta: "1–2 business days", price: 14 },
];

export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "United Arab Emirates",
  "Saudi Arabia",
  "Egypt",
];
