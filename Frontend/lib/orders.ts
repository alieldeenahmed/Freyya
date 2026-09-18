import { useSyncExternalStore } from "react";
import type { ShippingId, Totals } from "@/lib/shipping";

export * from "@/lib/shipping";

// One line of a placed order, as the API returns it.
export interface OrderLine {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  color: string;
  image: string;
  quantity: number;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

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
  items: OrderLine[];
  totals: Totals;
  currency: string;
  status: OrderStatus;
}

// The order the API just confirmed is kept in this browser so the confirmation
// page can show it, including after a refresh.
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
