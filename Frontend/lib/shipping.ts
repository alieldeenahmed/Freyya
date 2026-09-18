import type { CartItem } from "@/lib/cart-store";

// Plain data and arithmetic only, so server pages can import it too.

export const FREE_SHIPPING_THRESHOLD = 75;

export type ShippingId = "standard" | "express";

export interface ShippingMethod {
  id: ShippingId;
  label: string;
  eta: string;
  price: number;
  // Standard shipping is free above this subtotal.
  freeOver?: number;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: "standard", label: "Standard", eta: "3–5 business days", price: 6, freeOver: FREE_SHIPPING_THRESHOLD },
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

export interface Totals {
  subtotal: number;
  shipping: number;
  total: number;
}

export function getShippingMethod(id: ShippingId): ShippingMethod {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? SHIPPING_METHODS[0];
}

export function computeTotals(
  items: Pick<CartItem, "price" | "quantity">[],
  shippingId: ShippingId
): Totals {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const method = getShippingMethod(shippingId);
  const isFree = method.freeOver !== undefined && subtotal >= method.freeOver;
  const shipping = subtotal === 0 || isFree ? 0 : method.price;

  return { subtotal, shipping, total: subtotal + shipping };
}
