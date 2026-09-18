import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { inventoryMovements, products, skus } from "./schema.js";
import { seedProducts, type SeedProduct } from "./seed-data.js";

function skuRows(product: SeedProduct) {
  if (!product.variants) {
    return [
      {
        id: product.id,
        productId: product.id,
        stock: product.stock ?? 0,
        sortOrder: 0,
      },
    ];
  }

  return product.variants.map((variant, index) => ({
    id: `${product.id}:${variant.id}`,
    productId: product.id,
    variantId: variant.id,
    variantName: variant.name,
    hex: variant.hex,
    image: variant.image,
    undertone: variant.undertone,
    intensity: variant.intensity,
    stock: variant.stock,
    sortOrder: index,
  }));
}

// Safe to run again: product details are refreshed, but stock that already exists is left alone.
export async function seedCatalog(db: Db, catalog: SeedProduct[] = seedProducts) {
  await db.transaction(async (tx) => {
    for (const [index, product] of catalog.entries()) {
      const values = {
        name: product.name,
        category: product.category,
        tagline: product.tagline,
        description: product.description,
        priceCents: Math.round(product.price * 100),
        specs: product.specs,
        color: product.color,
        image: product.image,
        showcase: product.showcase ?? null,
        details: product.details,
        related: product.related,
        isHero: product.isHero ?? false,
        sortOrder: index,
      };

      await tx
        .insert(products)
        .values({ id: product.id, ...values })
        .onConflictDoUpdate({ target: products.id, set: { ...values, updatedAt: new Date() } });

      for (const row of skuRows(product)) {
        const [created] = await tx.insert(skus).values(row).onConflictDoNothing().returning();

        if (created) {
          await tx.insert(inventoryMovements).values({
            skuId: created.id,
            delta: created.stock,
            stockAfter: created.stock,
            reason: "seed",
            note: "Launch stock",
          });
        } else {
          const { stock: _stock, id: _id, ...details } = row;
          await tx.update(skus).set(details).where(eq(skus.id, row.id));
        }
      }
    }
  });
}
