import type { ShippingId } from "../db/schema.js";

// All money is whole cents, so totals never pick up floating-point error.

export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

export interface ShippingMethod {
  id: ShippingId;
  label: string;
  eta: string;
  priceCents: number;
  // Standard shipping is free once the subtotal reaches this.
  freeOverCents?: number;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: "standard",
    label: "Standard",
    eta: "3–5 business days",
    priceCents: 600,
    freeOverCents: FREE_SHIPPING_THRESHOLD_CENTS,
  },
  { id: "express", label: "Express", eta: "1–2 business days", priceCents: 1400 },
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
] as const;

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export function getShippingMethod(id: ShippingId): ShippingMethod {
  const method = SHIPPING_METHODS.find((m) => m.id === id);
  if (!method) throw new Error(`Unknown shipping method: ${id}`);
  return method;
}

export function computeTotals(subtotalCents: number, shippingId: ShippingId): Totals {
  const method = getShippingMethod(shippingId);
  const isFree = method.freeOverCents !== undefined && subtotalCents >= method.freeOverCents;
  const shippingCents = subtotalCents === 0 || isFree ? 0 : method.priceCents;

  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
