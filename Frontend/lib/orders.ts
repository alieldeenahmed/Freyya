import { useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart-store";

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

export interface Order {
  id: string;
  placedAt: string;
  email: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
  };
  shippingId: ShippingId;
  items: CartItem[];
  totals: Totals;
}

export function generateOrderId(): string {
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `FRY-${time}${rand}`;
}

// With no backend yet the last order is kept in this browser so the
// confirmation page can show it. Swap for an API call when there is one.
const KEY = "freyya:last-order";
const listeners = new Set<() => void>();
let cache: { raw: string | null; parsed: Order | null } = { raw: null, parsed: null };

function readOrder(): Order | null | undefined {
  if (typeof window === "undefined") return undefined;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.parsed;
  }

  if (raw === cache.raw && cache.raw !== null) return cache.parsed;

  let parsed: Order | null = null;
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data.id === "string" && Array.isArray(data.items) && data.totals) {
      parsed = data as Order;
    }
  } catch {
    parsed = null;
  }

  cache = { raw, parsed };
  return parsed;
}

export function saveOrder(order: Order) {
  const raw = JSON.stringify(order);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Keep it for this session at least.
  }
  cache = { raw, parsed: order };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// undefined until the browser has been read; null when there is no order.
export function useLastOrder(): Order | null | undefined {
  return useSyncExternalStore(subscribe, readOrder, () => undefined);
}
