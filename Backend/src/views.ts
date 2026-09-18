import type { InferSelectModel } from "drizzle-orm";
import type { orderItems, orders, products, skus, ProductDetails } from "./db/schema.js";

// What the API returns. The shapes follow the storefront's own types, with prices
// in dollars, so the frontend needs few changes to read them.

const dollars = (cents: number) => cents / 100;

export interface VariantView {
  id: string;
  name: string;
  hex: string;
  image: string;
  stock: number;
  undertone: string;
  intensity: string;
}

export interface ProductView {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  price: number;
  specs: string[];
  color: string;
  image: string;
  showcase?: string[];
  details: ProductDetails;
  related: string[];
  isHero?: boolean;
  // A product with shades tracks stock on each shade instead.
  stock?: number;
  variants?: VariantView[];
}

type ProductRow = InferSelectModel<typeof products>;
type SkuRow = InferSelectModel<typeof skus>;

export function toProductView(product: ProductRow, productSkus: SkuRow[]): ProductView {
  const shades = productSkus.filter((sku) => sku.variantId !== null);

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    tagline: product.tagline,
    description: product.description,
    price: dollars(product.priceCents),
    specs: product.specs,
    color: product.color,
    image: product.image,
    ...(product.showcase && { showcase: product.showcase }),
    details: product.details,
    related: product.related,
    ...(product.isHero && { isHero: true }),
    ...(shades.length > 0
      ? {
          variants: shades.map((sku) => ({
            id: sku.variantId as string,
            name: sku.variantName ?? "",
            hex: sku.hex ?? "",
            image: sku.image ?? product.image,
            stock: sku.stock,
            undertone: sku.undertone ?? "",
            intensity: sku.intensity ?? "",
          })),
        }
      : { stock: productSkus[0]?.stock ?? 0 }),
  };
}

type OrderRow = InferSelectModel<typeof orders>;
type OrderItemRow = InferSelectModel<typeof orderItems>;

export interface OrderItemView {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  color: string;
  image: string;
  quantity: number;
}

export interface OrderView {
  id: string;
  placedAt: string;
  email: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
  };
  shippingId: string;
  items: OrderItemView[];
  totals: { subtotal: number; shipping: number; total: number };
  currency: string;
  status: string;
  reservedUntil: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toOrderView(order: OrderRow, items: OrderItemRow[]): OrderView {
  return {
    id: order.id,
    placedAt: order.createdAt.toISOString(),
    email: order.email,
    name: order.name,
    address: {
      line1: order.addressLine1,
      ...(order.addressLine2 && { line2: order.addressLine2 }),
      city: order.city,
      postalCode: order.postalCode,
      country: order.country,
    },
    shippingId: order.shippingMethod,
    items: items.map((item) => {
      const variantId = item.skuId.startsWith(`${item.productId}:`)
        ? item.skuId.slice(item.productId.length + 1)
        : undefined;
      return {
        id: item.skuId,
        productId: item.productId,
        ...(variantId && { variantId }),
        name: item.name,
        ...(item.variantName && { variantName: item.variantName }),
        price: dollars(item.unitPriceCents),
        color: item.color,
        image: item.image,
        quantity: item.quantity,
      };
    }),
    totals: {
      subtotal: dollars(order.subtotalCents),
      shipping: dollars(order.shippingCents),
      total: dollars(order.totalCents),
    },
    currency: order.currency,
    status: order.status,
    reservedUntil: iso(order.reservedUntil),
    paidAt: iso(order.paidAt),
    shippedAt: iso(order.shippedAt),
    deliveredAt: iso(order.deliveredAt),
    cancelledAt: iso(order.cancelledAt),
  };
}
