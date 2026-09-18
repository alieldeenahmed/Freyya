import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { products, skus } from "../db/schema.js";
import { toProductView, type ProductView } from "../views.js";

export async function listProducts(db: Db): Promise<ProductView[]> {
  const [productRows, skuRows] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(products.sortOrder),
    db.select().from(skus).orderBy(skus.sortOrder),
  ]);

  return productRows.map((product) =>
    toProductView(
      product,
      skuRows.filter((sku) => sku.productId === product.id)
    )
  );
}

export async function getProduct(db: Db, id: string): Promise<ProductView | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product || !product.active) return null;

  const productSkus = await db
    .select()
    .from(skus)
    .where(eq(skus.productId, id))
    .orderBy(skus.sortOrder);

  return toProductView(product, productSkus);
}
