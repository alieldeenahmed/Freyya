import { and, eq, gte, sql } from "drizzle-orm";
import type { Tx } from "../db/client.js";
import { inventoryMovements, skus, type MovementReason } from "../db/schema.js";

interface StockChange {
  skuId: string;
  // Negative to take stock out, positive to put it back.
  delta: number;
  reason: MovementReason;
  orderId?: string;
  note?: string;
  actor?: string;
}

// The only place stock changes. Taking out more than exists changes nothing and
// returns null; otherwise the new count is returned and the change is recorded.
export async function applyStockChange(tx: Tx, change: StockChange): Promise<number | null> {
  const [row] = await tx
    .update(skus)
    .set({ stock: sql`${skus.stock} + ${change.delta}`, updatedAt: new Date() })
    .where(
      change.delta < 0
        ? and(eq(skus.id, change.skuId), gte(skus.stock, -change.delta))
        : eq(skus.id, change.skuId)
    )
    .returning({ stock: skus.stock });

  if (!row) return null;

  await tx.insert(inventoryMovements).values({
    skuId: change.skuId,
    delta: change.delta,
    stockAfter: row.stock,
    reason: change.reason,
    orderId: change.orderId ?? null,
    note: change.note ?? null,
    actor: change.actor ?? "system",
  });

  return row.stock;
}
