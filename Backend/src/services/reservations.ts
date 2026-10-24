import { and, eq, exists, inArray, lte, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { orderItems, orders, skus } from "../db/schema.js";
import { applyStockChange } from "./inventory.js";

// An unpaid order holds its stock until `reserved_until`. This file is the only place that
// gives a held order's stock back when its time runs out, and it is used by every path that
// does: placing an order (lazily, for the items involved), the scheduled sweep, and the catalog read.
//
// Three rules keep it safe with many instances running at once:
//
// 1. Time comes from the database (`now()`), never from the process, so instances with
//    different clocks agree on what has expired.
// 2. The order rows are locked with SKIP LOCKED. An order that is being paid, cancelled or
//    released by someone else right now is left to them, and nothing here ever waits for an
//    order lock while holding an item lock.
// 3. The item rows are then locked in one batch, sorted by id, so every path takes item locks
//    in the same order and two of them can never wait on each other.
//
// The release itself only acts on an order that is still `pending_payment`, so however many
// callers race, an order is released once and its stock goes back once.

const RELEASE_NOTE = "Reservation expired";

// True when an unpaid order whose hold has run out still holds one of these items. Used to
// tell "this really is sold out" from "someone else is releasing a hold right now".
export async function expiredHoldExists(tx: Tx, skuIds: string[]): Promise<boolean> {
  const rows = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending_payment"),
        lte(orders.reservedUntil, sql`now()`),
        exists(
          tx
            .select({ one: sql`1` })
            .from(orderItems)
            .where(and(eq(orderItems.orderId, orders.id), inArray(orderItems.skuId, skuIds)))
        )
      )
    )
    .limit(1);
  return rows.length > 0;
}

// Locks, without waiting, the unpaid orders whose hold has run out. With `skuIds`, only those
// that hold at least one of the given items. Returns their ids in a fixed order.
export async function lockExpiredOrders(
  tx: Tx,
  options: { skuIds?: string[]; limit?: number } = {}
): Promise<string[]> {
  const holdsOneOfThese =
    options.skuIds && options.skuIds.length > 0
      ? exists(
          tx
            .select({ one: sql`1` })
            .from(orderItems)
            .where(and(eq(orderItems.orderId, orders.id), inArray(orderItems.skuId, options.skuIds)))
        )
      : undefined;

  const query = tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending_payment"),
        lte(orders.reservedUntil, sql`now()`),
        holdsOneOfThese
      )
    )
    .orderBy(orders.id);

  const rows = await (options.limit ? query.limit(options.limit) : query).for("update", {
    of: orders,
    skipLocked: true,
  });
  return rows.map((row) => row.id);
}

async function skuIdsHeldBy(tx: Tx, orderIds: string[]): Promise<string[]> {
  if (orderIds.length === 0) return [];
  const rows = await tx
    .selectDistinct({ skuId: orderItems.skuId })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(orderItems.skuId);
  return rows.map((row) => row.skuId);
}

// Locks item rows in one batch, sorted. Waits if someone holds them, which is safe because
// everyone takes them in this same order.
export async function lockSkus(tx: Tx, skuIds: string[]): Promise<void> {
  if (skuIds.length === 0) return;
  await tx
    .select({ id: skus.id })
    .from(skus)
    .where(inArray(skus.id, [...new Set(skuIds)]))
    .orderBy(skus.id)
    .for("update");
}

// Cancels the given (already locked) orders and puts their stock back. The caller holds the
// item locks. Returns how many were released: an order that is no longer unpaid is skipped.
async function releaseLocked(tx: Tx, orderIds: string[]): Promise<number> {
  let released = 0;

  for (const id of orderIds) {
    const [done] = await tx
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: sql`now()`,
        reservedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(orders.id, id), eq(orders.status, "pending_payment")))
      .returning({ id: orders.id });
    if (!done) continue;

    const items = await tx
      .select({ skuId: orderItems.skuId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.skuId);

    for (const item of items) {
      await applyStockChange(tx, {
        skuId: item.skuId,
        delta: item.quantity,
        reason: "cancellation",
        orderId: id,
        note: RELEASE_NOTE,
      });
    }
    released += 1;
  }
  return released;
}

// Used while placing an order, inside its transaction and before any of its own item locks.
// Frees every expired hold on the given items, and leaves those items (and any others those
// holds covered) locked for the caller.
export async function releaseExpiredFor(tx: Tx, skuIds: string[]): Promise<number> {
  const expired = await lockExpiredOrders(tx, { skuIds });
  if (expired.length === 0) return 0;

  const covered = await skuIdsHeldBy(tx, expired);
  await lockSkus(tx, [...skuIds, ...covered]);
  return releaseLocked(tx, expired);
}

// Releases expired holds anywhere in the shop, in small batches. Safe to run on a schedule,
// by several callers at once, and again and again.
export async function sweepExpiredReservations(
  db: Db,
  options: { batchSize?: number; maxBatches?: number } = {}
): Promise<number> {
  const batchSize = options.batchSize ?? 25;
  const maxBatches = options.maxBatches ?? 20;
  let total = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const released = await db.transaction(async (tx) => {
      const expired = await lockExpiredOrders(tx, { limit: batchSize });
      if (expired.length === 0) return -1;
      await lockSkus(tx, await skuIdsHeldBy(tx, expired));
      return releaseLocked(tx, expired);
    });
    if (released < 0) break;
    total += released;
  }
  return total;
}

// Kept under its old name for the callers and tests that already use it.
export const expireReservations = (db: Db): Promise<number> => sweepExpiredReservations(db);

// A cheap look, with one indexed query, at whether any hold has run out.
export async function hasExpiredHolds(db: Db): Promise<boolean> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lte(orders.reservedUntil, sql`now()`)))
    .limit(1);
  return rows.length > 0;
}

// Run before the catalog is read, so the stock it shows is right the moment a hold ends
// instead of when the next scheduled sweep comes round. It never makes a read fail.
export async function releaseBeforeRead(db: Db): Promise<void> {
  try {
    if (await hasExpiredHolds(db)) await sweepExpiredReservations(db, { maxBatches: 2 });
  } catch {
    // The read is more important than the clean-up, and the next sweep will try again.
  }
}
