import { ApiError, NETWORK_ERROR, TIMEOUT, UNAVAILABLE, apiFetch } from "@/lib/api";
import { MAX_PER_ITEM } from "@/lib/cart-store";
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
  // True when the bag itself is what is wrong, so it should be checked against the store again.
  refreshBag: boolean;
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
    refreshBag: false,
  };

  if (!(error instanceof ApiError)) return problem;

  if (error.code === NETWORK_ERROR) {
    return { ...problem, message: error.message };
  }

  // The order may or may not have reached the store. Trying again with the same request key
  // is safe either way: the store gives back the order it already made instead of a second one.
  if (error.code === TIMEOUT) {
    return {
      ...problem,
      message: "The store took too long to answer. Your bag is safe. Try again, and you will not be charged twice.",
    };
  }

  if (error.code === UNAVAILABLE) {
    return { ...problem, message: "The store is not answering right now. Your bag is safe. Please try again in a moment." };
  }

  if (error.code === "validation_error") {
    // Whatever arrives is not trusted to have the shape it should. This runs in the error path,
    // where a crash would leave the order button stuck.
    const details = (Array.isArray(error.details) ? error.details : []).filter(
      (entry): entry is { path?: string } => Boolean(entry) && typeof entry === "object"
    );
    for (const { path = "" } of details) {
      const field = FIELD_FOR_PATH[path];
      if (field) problem.fieldErrors[field.key] = field.message;
    }
    if (Object.keys(problem.fieldErrors).length > 0) {
      return { ...problem, message: "Please check the highlighted fields.", retryable: false };
    }
    // Nothing on the form is wrong, so it is the bag: say what the limit is.
    if (details.some(({ path = "" }) => path.startsWith("items"))) {
      return {
        ...problem,
        message: `One order can hold at most ${MAX_PER_ITEM} of any item. We've checked your bag again.`,
        retryable: false,
        refreshBag: true,
      };
    }
    return { ...problem, message: "Please check your details and try again.", retryable: false };
  }

  if (error.code === "idempotency_key_reused") {
    return {
      ...problem,
      message: "Something changed while your order was being sent. Please check it and place it again.",
      retryable: false,
    };
  }

  if (error.code === "order_closed") {
    return { ...problem, message: "That order was closed before it could be paid. Please place it again.", retryable: false };
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
      refreshBag: true,
    };
  }

  if (error.code === "unknown_item") {
    const skuIds = ((error.details as { skuIds?: string[] } | undefined)?.skuIds ?? []);
    for (const id of skuIds) problem.stockLimits[id] = 0;
    return {
      ...problem,
      message: "Some items are no longer available. We've taken them out of your bag.",
      retryable: false,
      refreshBag: true,
    };
  }

  if (error.status === 429 || error.code === "rate_limited") {
    return { ...problem, message: "Too many attempts. Please wait a minute and try again." };
  }

  // The order can't proceed as it stands, for example its stock hold ran out.
  if (error.status >= 400 && error.status < 500) {
    return { ...problem, message: error.message, retryable: false };
  }

  return problem;
}
