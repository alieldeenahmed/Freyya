import { and, eq, inArray, lt } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Db, Tx } from "../db/client.js";
import { orderItems, orders, products, skus, type ShippingId } from "../db/schema.js";
import { generateOrderId } from "../domain/order-id.js";
import { computeTotals } from "../domain/pricing.js";
import { HttpError, notFound } from "../errors.js";
import { toOrderView, type OrderView } from "../views.js";
import { applyStockChange } from "./inventory.js";
import type { PaymentProvider } from "./payments.js";

type Executor = Db | Tx;

export interface OrderInput {
  email: string;
  name: string;
  address: {
    line1: string;
    line2?: string | undefined;
    city: string;
    postalCode: string;
    country: string;
  };
  shippingId: ShippingId;
  items: { skuId: string; quantity: number }[];
}

// Drizzle wraps driver errors, so look through to the Postgres error underneath.
function pgError(error: unknown): { code?: string; constraint?: string } {
  let current = error as { code?: string; constraint?: string; cause?: unknown } | undefined;
  while (current && current.code === undefined && current.cause) {
    current = current.cause as typeof current;
  }
  return current ?? {};
}

export async function loadOrder(executor: Executor, id: string): Promise<OrderView | null> {
  const [order] = await executor.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;

  const items = await executor
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(orderItems.id);

  return toOrderView(order, items);
}

async function loadByIdempotencyKey(db: Db, key: string): Promise<OrderView | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  return row ? loadOrder(db, row.id) : null;
}

export async function createOrder(
  db: Db,
  config: Config,
  input: OrderInput,
  idempotencyKey?: string
): Promise<{ order: OrderView; created: boolean }> {
  if (idempotencyKey) {
    const existing = await loadByIdempotencyKey(db, idempotencyKey);
    if (existing) return { order: existing, created: false };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const id = await db.transaction((tx) => placeOrder(tx, config, input, idempotencyKey));
      const order = await loadOrder(db, id);
      if (!order) throw new Error("Order vanished after creation");
      return { order, created: true };
    } catch (error) {
      const { code, constraint } = pgError(error);
      if (code !== "23505") throw error;

      // Two identical requests raced: hand back the one that won.
      if (idempotencyKey && constraint?.includes("idempotency_key")) {
        const existing = await loadByIdempotencyKey(db, idempotencyKey);
        if (existing) return { order: existing, created: false };
      }
      // Otherwise the random order number collided; try another.
    }
  }

  throw new HttpError(500, "order_id_exhausted", "Could not allocate an order number");
}

async function placeOrder(
  tx: Tx,
  config: Config,
  input: OrderInput,
  idempotencyKey: string | undefined
): Promise<string> {
  // The same item twice becomes one line.
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    quantities.set(line.skuId, (quantities.get(line.skuId) ?? 0) + line.quantity);
  }
  const skuIds = [...quantities.keys()].sort();

  // Locking in a fixed order means two orders that share items can't deadlock.
  const rows = await tx
    .select({ sku: skus, product: products })
    .from(skus)
    .innerJoin(products, eq(skus.productId, products.id))
    .where(inArray(skus.id, skuIds))
    .orderBy(skus.id)
    .for("update", { of: skus });

  const found = new Map(rows.map((row) => [row.sku.id, row]));

  const unknown = skuIds.filter((id) => !found.get(id)?.product.active);
  if (unknown.length > 0) {
    throw new HttpError(422, "unknown_item", "Some items are not available.", {
      skuIds: unknown,
    });
  }

  const short = skuIds
    .map((id) => ({
      skuId: id,
      requested: quantities.get(id) ?? 0,
      available: found.get(id)?.sku.stock ?? 0,
    }))
    .filter((line) => line.requested > line.available);
  if (short.length > 0) {
    throw new HttpError(409, "insufficient_stock", "Not enough stock for some items.", {
      items: short,
    });
  }

  // Prices come from the database. Whatever the client believes is ignored.
  const lines = skuIds.map((id) => {
    const { sku, product } = found.get(id)!;
    return { sku, product, quantity: quantities.get(id)! };
  });
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0
  );
  const totals = computeTotals(subtotalCents, input.shippingId);

  const orderId = generateOrderId();
  const reservedUntil = new Date(Date.now() + config.RESERVATION_MINUTES * 60_000);

  await tx.insert(orders).values({
    id: orderId,
    idempotencyKey: idempotencyKey ?? null,
    email: input.email,
    name: input.name,
    addressLine1: input.address.line1,
    addressLine2: input.address.line2 ?? null,
    city: input.address.city,
    postalCode: input.address.postalCode,
    country: input.address.country,
    shippingMethod: input.shippingId,
    subtotalCents: totals.subtotalCents,
    shippingCents: totals.shippingCents,
    totalCents: totals.totalCents,
    status: "pending_payment",
    reservedUntil,
  });

  await tx.insert(orderItems).values(
    lines.map(({ sku, product, quantity }) => ({
      orderId,
      skuId: sku.id,
      productId: product.id,
      name: product.name,
      variantName: sku.variantName,
      color: sku.hex ?? product.color,
      image: sku.image ?? product.image,
      unitPriceCents: product.priceCents,
      quantity,
    }))
  );

  for (const { sku, quantity } of lines) {
    const after = await applyStockChange(tx, {
      skuId: sku.id,
      delta: -quantity,
      reason: "order",
      orderId,
    });
    // Rows are locked, so this cannot happen. It stays as a guard, not as a code path.
    if (after === null) {
      throw new HttpError(409, "insufficient_stock", "Not enough stock for some items.");
    }
  }

  return orderId;
}

async function lockOrder(tx: Tx, id: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
  return order;
}

// Puts the stock back and closes the order. The caller holds the order's row lock.
export async function cancelLockedOrder(
  tx: Tx,
  orderId: string,
  options: { actor: string; note: string }
) {
  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.skuId);

  for (const item of items) {
    await applyStockChange(tx, {
      skuId: item.skuId,
      delta: item.quantity,
      reason: "cancellation",
      orderId,
      note: options.note,
      actor: options.actor,
    });
  }

  await tx
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      reservedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Customers find an order with its number and the email used, and nothing else.
export async function getOrderForCustomer(db: Db, id: string, email: string): Promise<OrderView> {
  const order = await loadOrder(db, id);
  // Same answer for a wrong number and a wrong email, so numbers can't be probed.
  if (!order || !sameEmail(order.email, email)) throw notFound("Order not found");
  return order;
}

export async function payOrder(
  db: Db,
  payments: PaymentProvider,
  id: string,
  email: string
): Promise<OrderView> {
  const outcome = await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (!order || !sameEmail(order.email, email)) throw notFound("Order not found");

    if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
      return "already_paid" as const;
    }
    if (order.status !== "pending_payment") {
      throw new HttpError(409, "order_closed", "This order can no longer be paid.");
    }

    if (order.reservedUntil && order.reservedUntil.getTime() <= Date.now()) {
      await cancelLockedOrder(tx, id, { actor: "system", note: "Reservation expired" });
      return "expired" as const;
    }

    const { reference } = await payments.charge({
      orderId: id,
      amountCents: order.totalCents,
      currency: order.currency,
    });

    await tx
      .update(orders)
      .set({
        status: "paid",
        paymentRef: reference,
        paidAt: new Date(),
        reservedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    return "paid" as const;
  });

  // The cancellation above has to commit before we report it, so this is thrown here.
  if (outcome === "expired") {
    throw new HttpError(
      409,
      "reservation_expired",
      "Your items were held for too long and have been released. Please start again."
    );
  }

  const paid = await loadOrder(db, id);
  if (!paid) throw notFound("Order not found");
  return paid;
}

// Cancels unpaid orders whose hold has run out, returning their stock.
export async function expireReservations(db: Db, now = new Date()): Promise<number> {
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lt(orders.reservedUntil, now)));

  let released = 0;
  for (const { id } of stale) {
    await db.transaction(async (tx) => {
      const order = await lockOrder(tx, id);
      if (!order || order.status !== "pending_payment") return;
      await cancelLockedOrder(tx, id, { actor: "system", note: "Reservation expired" });
      released += 1;
    });
  }
  return released;
}
