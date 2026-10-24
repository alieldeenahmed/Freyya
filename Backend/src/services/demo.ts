import { and, eq, inArray, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { DEMO_MARKER, DEMO_ORDERS, demoAddress } from "../db/demo-seed.js";
import {
  adminSessions,
  appMeta,
  inventoryMovements,
  orderItems,
  orders,
  products,
  rateLimits,
  skus,
} from "../db/schema.js";
import { seedCatalogIn } from "../db/seed-catalog.js";
import { seedProducts } from "../db/seed-data.js";
import { computeTotals } from "../domain/pricing.js";
import { HttpError } from "../errors.js";
import { applyStockChange } from "./inventory.js";

export async function isDemoDatabase(db: Db): Promise<boolean> {
  const [row] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(and(eq(appMeta.key, DEMO_MARKER.key), eq(appMeta.value, DEMO_MARKER.value)))
    .limit(1);
  return Boolean(row);
}

// Puts the public demo back to a known state. It can only ever run on the demo database:
// the flag must be on, and the database itself must carry the marker. Both are checked before
// anything is deleted, and the marker is checked again inside the transaction.
export async function resetDemo(db: Db, config: Config) {
  if (!config.DEMO_MODE) {
    throw new HttpError(403, "demo_only", "The demo reset only runs when DEMO_MODE is on.");
  }
  if (!(await isDemoDatabase(db))) {
    throw new HttpError(
      403,
      "not_demo_database",
      "This database is not marked as the demo database, so it will not be reset."
    );
  }

  return db.transaction(async (tx) => {
    // Only one reset at a time.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('freyya-demo-reset'))`);

    const [marker] = await tx
      .select({ value: appMeta.value })
      .from(appMeta)
      .where(and(eq(appMeta.key, DEMO_MARKER.key), eq(appMeta.value, DEMO_MARKER.value)));
    if (!marker) {
      throw new HttpError(403, "not_demo_database", "This database is not marked as the demo database.");
    }

    // Wait for anything in flight, and hold off anything new, until the reset is done. A
    // customer who arrives meanwhile simply waits a moment.
    await tx.execute(
      sql`lock table orders, order_items, inventory_movements, skus, products, admin_sessions, rate_limits in access exclusive mode`
    );

    await tx.delete(inventoryMovements);
    await tx.delete(orders); // order items go with them
    await tx.delete(adminSessions);
    await tx.delete(rateLimits);

    // Product details are refreshed, anything switched off is back on, and every item gets its
    // launch stock and a fresh ledger that starts from it.
    await seedCatalogIn(tx);
    await tx.update(products).set({ active: true });

    const launch = seedProducts.flatMap((product) =>
      product.variants
        ? product.variants.map((variant) => ({ id: `${product.id}:${variant.id}`, stock: variant.stock }))
        : [{ id: product.id, stock: product.stock ?? 0 }]
    );
    for (const { id, stock } of launch) {
      await tx.update(skus).set({ stock, updatedAt: sql`now()` }).where(eq(skus.id, id));
      await tx.insert(inventoryMovements).values({
        skuId: id,
        delta: stock,
        stockAfter: stock,
        reason: "seed",
        note: "Launch stock",
      });
    }

    // The fake orders, priced from the catalog the way a real order would be.
    const catalog = await tx.select().from(products);
    const skuRows = await tx
      .select()
      .from(skus)
      .where(inArray(skus.id, [...new Set(DEMO_ORDERS.flatMap((o) => o.items.map((i) => i.skuId)))]));
    const productOf = new Map(catalog.map((p) => [p.id, p]));
    const skuOf = new Map(skuRows.map((s) => [s.id, s]));

    for (const [index, demo] of DEMO_ORDERS.entries()) {
      const lines = demo.items.map((item) => {
        const sku = skuOf.get(item.skuId)!;
        return { sku, product: productOf.get(sku.productId)!, quantity: item.quantity };
      });
      const totals = computeTotals(
        lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0),
        demo.shippingId
      );
      const placed = sql`now() - make_interval(hours => ${demo.hoursAgo}::int)`;
      const later = (minutes: number) =>
        sql`now() - make_interval(hours => ${demo.hoursAgo}::int) + make_interval(mins => ${minutes}::int)`;
      const wasShipped =
        demo.status === "shipped" || demo.status === "delivered" || demo.status === "refunded";
      const address = demoAddress(index + 1);

      await tx.insert(orders).values({
        id: demo.id,
        email: demo.email,
        name: demo.name,
        addressLine1: address.line1,
        city: address.city,
        postalCode: address.postalCode,
        country: address.country,
        shippingMethod: demo.shippingId,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        status: demo.status,
        paymentRef: demo.status === "cancelled" ? null : `sim_demo_${demo.id}`,
        paidAt: demo.status === "cancelled" ? null : later(5),
        shippedAt: wasShipped ? later(60 * 6) : null,
        deliveredAt: demo.status === "delivered" || demo.status === "refunded" ? later(60 * 40) : null,
        cancelledAt: demo.status === "cancelled" ? later(90) : null,
        createdAt: placed,
        updatedAt: placed,
      });

      await tx.insert(orderItems).values(
        lines.map(({ sku, product, quantity }) => ({
          orderId: demo.id,
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
        await applyStockChange(tx, { skuId: sku.id, delta: -quantity, reason: "order", orderId: demo.id });
        if (demo.status === "cancelled") {
          await applyStockChange(tx, {
            skuId: sku.id,
            delta: quantity,
            reason: "cancellation",
            orderId: demo.id,
            note: "Cancelled from admin",
            actor: "demo",
          });
        }
      }
    }

    return { orders: DEMO_ORDERS.length, items: launch.length };
  });
}
