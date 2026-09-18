import { ApiError, apiFetch } from "@/lib/api";
import type { CartItem } from "@/lib/cart-store";
import type { Order } from "@/lib/orders";
import type { ShippingId } from "@/lib/shipping";

export interface CheckoutFields {
  email: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
}

export type FieldKey = keyof CheckoutFields;

export interface OrderRequest {
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
  items: { skuId: string; quantity: number }[];
}

// Only what to buy and where to send it. Prices and totals are the server's to decide.
export function toOrderRequest(
  fields: CheckoutFields,
  shippingId: ShippingId,
  items: Pick<CartItem, "id" | "quantity">[]
): OrderRequest {
  const line2 = fields.line2.trim();

  return {
    email: fields.email.trim(),
    name: fields.name.trim(),
    address: {
      line1: fields.line1.trim(),
      ...(line2 && { line2 }),
      city: fields.city.trim(),
      postalCode: fields.postalCode.trim(),
      country: fields.country,
    },
    shippingId,
    items: items.map((item) => ({ skuId: item.id, quantity: item.quantity })),
  };
}

// Sending the same key again returns the same order, so a retry can't charge twice.
export async function placeOrder(request: OrderRequest, idempotencyKey: string): Promise<Order> {
  const { order } = await apiFetch<{ order: Order }>("/orders", {
    method: "POST",
    json: request,
    headers: { "idempotency-key": idempotencyKey },
  });
  return order;
}

export async function payForOrder(id: string, email: string): Promise<Order> {
  const { order } = await apiFetch<{ order: Order }>(`/orders/${id}/pay`, {
    method: "POST",
    json: { email },
  });
  return order;
}

export interface CheckoutProblem {
  message: string;
  fieldErrors: Partial<Record<FieldKey, string>>;
  // Bag lines to correct, by line id. 0 means take it out.
  stockLimits: Record<string, number>;
  // True when sending the very same request again is the right thing to do.
  retryable: boolean;
}

const FIELD_FOR_PATH: Record<string, { key: FieldKey; message: string }> = {
  email: { key: "email", message: "Enter a valid email address." },
  name: { key: "name", message: "Enter your full name." },
  "address.line1": { key: "line1", message: "Enter your street address." },
  "address.line2": { key: "line2", message: "That line is too long." },
  "address.city": { key: "city", message: "Enter your city." },
  "address.postalCode": { key: "postalCode", message: "Enter your postal code." },
  "address.country": { key: "country", message: "Choose a country we deliver to." },
};

interface StockDetails {
  items?: { skuId: string; requested: number; available: number }[];
}

// Turns whatever went wrong into something the shopper can act on.
export function describeCheckoutError(
  error: unknown,
  lineNames: Record<string, string> = {}
): CheckoutProblem {
  const problem: CheckoutProblem = {
    message: "Something went wrong on our side. Please try again.",
    fieldErrors: {},
    stockLimits: {},
    retryable: true,
  };

  if (!(error instanceof ApiError)) return problem;

  if (error.code === "network_error") {
    return { ...problem, message: error.message };
  }

  if (error.code === "validation_error") {
    const details = (error.details ?? []) as { path: string }[];
    for (const { path } of details) {
      const field = FIELD_FOR_PATH[path];
      if (field) problem.fieldErrors[field.key] = field.message;
    }
    return { ...problem, message: "Please check the highlighted fields.", retryable: false };
  }

  if (error.code === "insufficient_stock") {
    const items = (error.details as StockDetails | undefined)?.items ?? [];
    const sentences = items.map(({ skuId, available }) => {
      problem.stockLimits[skuId] = available;
      const name = lineNames[skuId] ?? "An item";
      return available > 0 ? `${name}: only ${available} left.` : `${name} has just sold out.`;
    });
    return {
      ...problem,
      message: `${sentences.join(" ")} We've updated your bag.`.trim(),
      retryable: false,
    };
  }

  if (error.code === "unknown_item") {
    const skuIds = ((error.details as { skuIds?: string[] } | undefined)?.skuIds ?? []);
    for (const id of skuIds) problem.stockLimits[id] = 0;
    return {
      ...problem,
      message: "Some items are no longer available. We've taken them out of your bag.",
      retryable: false,
    };
  }

  if (error.status === 429) {
    return { ...problem, message: "Too many attempts. Please wait a minute and try again." };
  }

  // The order can't proceed as it stands, for example its stock hold ran out.
  if (error.status >= 400 && error.status < 500) {
    return { ...problem, message: error.message, retryable: false };
  }

  return problem;
}
