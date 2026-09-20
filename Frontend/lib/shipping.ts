import type { CartItem } from "@/lib/cart-store";
import { SHIPPING_METHODS, type ShippingId, type ShippingMethod } from "@/data/shop-rules";

// Plain data and arithmetic only, so server pages can import it too.

// The rules themselves (prices, countries, limits) come from the API's own definitions, copied
// into data/shop-rules.ts by `npm run sync:data`. Only the arithmetic lives here.
export {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD,
  MAX_PER_ITEM,
  SHIPPING_METHODS,
  type ShippingId,
  type ShippingMethod,
} from "@/data/shop-rules";

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
