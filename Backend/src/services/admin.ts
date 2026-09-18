import { and, count, desc, eq, gte, ilike, inArray, or, sql, sum } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  inventoryMovements,
  orders,
  ORDER_STATUSES,
  products,
  skus,
  type OrderStatus,
} from "../db/schema.js";
import { allowedNext, canTransition } from "../domain/order-status.js";
import { HttpError, notFound } from "../errors.js";
import { applyStockChange } from "./inventory.js";
import { cancelLockedOrder, loadOrder } from "./orders.js";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export interface ListOrdersOptions {
  status?: OrderStatus | undefined;
  search?: string | undefined;
  page: number;
  pageSize: number;
}

export async function listOrders(db: Db, options: ListOrdersOptions) {
  const filters = [];
  if (options.status) filters.push(eq(orders.status, options.status));
  if (options.search) {
    const pattern = `%${escapeLike(options.search)}%`;
    filters.push(
      or(ilike(orders.id, pattern), ilike(orders.email, pattern), ilike(orders.name, pattern))
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        name: orders.name,
        email: orders.email,
        status: orders.status,
        totalCents: orders.totalCents,
        shippingMethod: orders.shippingMethod,
        // Written out by hand: Drizzle drops table names in a single-table query, which would
        // make "id" here mean order_items.id instead of orders.id.
        itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = "orders"."id")`,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      placedAt: row.createdAt.toISOString(),
      name: row.name,
      email: row.email,
      status: row.status,
      total: row.totalCents / 100,
      shippingId: row.shippingMethod,
      itemCount: row.itemCount,
    })),
    page: options.page,
    pageSize: options.pageSize,
    total: totals?.total ?? 0,
  };
}

export async function getOrderDetail(db: Db, id: string) {
  const order = await loadOrder(db, id);
  if (!order) throw notFound("Order not found");
  return { ...order, nextStatuses: allowedNext(order.status as OrderStatus) };
}

export async function transitionOrder(db: Db, id: string, to: OrderStatus, actor: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
    if (!order) throw notFound("Order not found");

    if (!canTransition(order.status, to)) {
      throw new HttpError(
        409,
        "invalid_transition",
        `An order that is ${order.status.replace("_", " ")} can't become ${to.replace("_", " ")}.`,
        { from: order.status, to, allowed: allowedNext(order.status) }
      );
    }

    if (to === "cancelled") {
      await cancelLockedOrder(tx, id, { actor, note: "Cancelled from admin" });
      return;
    }

    const now = new Date();
    await tx
      .update(orders)
      .set({
        status: to,
        updatedAt: now,
        ...(to === "paid" && { paidAt: now, paymentRef: `manual:${actor}`, reservedUntil: null }),
        ...(to === "shipped" && { shippedAt: now }),
        ...(to === "delivered" && { deliveredAt: now }),
      })
      .where(eq(orders.id, id));
  });

  return getOrderDetail(db, id);
}

export async function listInventory(db: Db, lowThreshold: number) {
  const rows = await db
    .select({
      skuId: skus.id,
      productId: products.id,
      productName: products.name,
      variantName: skus.variantName,
      hex: skus.hex,
      stock: skus.stock,
      updatedAt: skus.updatedAt,
    })
    .from(skus)
    .innerJoin(products, eq(skus.productId, products.id))
    .orderBy(products.sortOrder, skus.sortOrder);

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    low: row.stock <= lowThreshold,
  }));
}

export async function adjustStock(
  db: Db,
  skuId: string,
  change: { delta: number; reason: "restock" | "adjustment"; note?: string | undefined },
  actor: string
) {
  return db.transaction(async (tx) => {
    const [sku] = await tx.select().from(skus).where(eq(skus.id, skuId)).for("update").limit(1);
    if (!sku) throw notFound("Item not found");

    const stock = await applyStockChange(tx, {
      skuId,
      delta: change.delta,
      reason: change.reason,
      ...(change.note && { note: change.note }),
      actor,
    });

    if (stock === null) {
      throw new HttpError(409, "insufficient_stock", "That would take stock below zero.", {
        available: sku.stock,
      });
    }
    return { skuId, stock };
  });
}

export async function listMovements(db: Db, skuId: string, limit = 50) {
  const rows = await db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.skuId, skuId))
    .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    delta: row.delta,
    stockAfter: row.stockAfter,
    reason: row.reason,
    orderId: row.orderId,
    note: row.note,
    actor: row.actor,
    at: row.createdAt.toISOString(),
  }));
}

export async function getStats(db: Db, lowThreshold: number) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [byStatus, [revenue], [recent], lowStock] = await Promise.all([
    db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
    db
      .select({ cents: sum(orders.totalCents) })
      .from(orders)
      .where(inArray(orders.status, ["paid", "shipped", "delivered"])),
    db.select({ total: count() }).from(orders).where(gte(orders.createdAt, weekAgo)),
    db
      .select({
        skuId: skus.id,
        productName: products.name,
        variantName: skus.variantName,
        stock: skus.stock,
      })
      .from(skus)
      .innerJoin(products, eq(skus.productId, products.id))
      .where(sql`${skus.stock} <= ${lowThreshold}`)
      .orderBy(skus.stock, skus.id),
  ]);

  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of byStatus) counts[row.status] = row.total;

  return {
    ordersByStatus: counts,
    revenue: Number(revenue?.cents ?? 0) / 100,
    ordersLast7Days: recent?.total ?? 0,
    lowStock,
    lowStockThreshold: lowThreshold,
  };
}
