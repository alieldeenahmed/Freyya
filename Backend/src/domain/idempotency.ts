import { createHash } from "node:crypto";
import type { OrderInput } from "../services/orders.js";

// Two requests are "the same order" when they would buy the same things and send them to the
// same place. Lines are merged and sorted first, so listing an item twice or in another order
// does not change the answer.
export function fingerprintOrder(input: OrderInput): string {
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    quantities.set(line.skuId, (quantities.get(line.skuId) ?? 0) + line.quantity);
  }

  const canonical = JSON.stringify({
    email: input.email,
    name: input.name,
    address: [
      input.address.line1,
      input.address.line2 ?? "",
      input.address.city,
      input.address.postalCode,
      input.address.country,
    ],
    shippingId: input.shippingId,
    items: [...quantities.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  });

  return createHash("sha256").update(canonical).digest("hex");
}
