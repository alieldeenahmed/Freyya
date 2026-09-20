import { MAX_PER_ITEM } from "@/data/shop-rules";
import { findProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  color: string;
  image: string;
  stock: number;
  quantity: number;
}

const KEY = "freyya:cart";
export const EMPTY_CART: CartItem[] = [];

const listeners = new Set<() => void>();
let cache: { raw: string | null; parsed: CartItem[] } = { raw: null, parsed: EMPTY_CART };
// Set when storage is unavailable (private mode, quota) so the cart still works.
let memoryOnly = false;

function looksLikeItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.productId === "string" &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity)
  );
}

// The most of one item a single order can hold. The API refuses more, so the bag never offers it.
export { MAX_PER_ITEM };

// How many of an item can be in the bag: what is in stock, up to the most one order can hold.
export const lineLimit = (stock: number) => Math.min(stock, MAX_PER_ITEM);

// Re-derive everything except which product, which shade and how many from the live catalog,
// so a saved bag can never carry an outdated price, image, stock level or item id. Lines for
// the same item are merged, and anything the shop no longer sells is dropped.
export function reconcileCart(items: CartItem[], catalog: Product[]): CartItem[] {
  const lines = new Map<string, CartItem>();
  const wanted = new Map<string, number>();

  for (const item of items) {
    const product = findProduct(catalog, item.productId);
    if (!product) continue;

    const variant = item.variantId
      ? product.variants?.find((v) => v.id === item.variantId)
      : undefined;
    if (product.variants && !variant) continue;

    // The id is built from the catalog, not trusted from storage, so an id saved by an older
    // version of the site, or edited by hand, still points at the right item.
    const id = variant ? `${product.id}:${variant.id}` : product.id;
    const stock = variant ? variant.stock : (product.stock ?? 0);

    wanted.set(id, (wanted.get(id) ?? 0) + Math.max(1, Math.floor(item.quantity)));
    if (lines.has(id)) continue;

    lines.set(id, {
      id,
      productId: product.id,
      ...(variant && { variantId: variant.id }),
      name: product.name,
      ...(variant && { variantName: variant.name }),
      price: product.price,
      color: variant?.hex ?? product.color,
      image: variant?.image ?? product.image,
      stock,
      quantity: 0,
    });
  }

  return [...lines.values()].flatMap((line) => {
    const quantity = Math.min(wanted.get(line.id) ?? 0, lineLimit(line.stock));
    return quantity < 1 ? [] : [{ ...line, quantity }];
  });
}

// What changed in a saved bag when it was checked against the shop, in words a shopper can
// read. Empty when nothing did. Each line is checked on its own, so a line that was merged
// into another does not count as a change.
export function explainChanges(stored: CartItem[], catalog: Product[]): string[] {
  const notes: string[] = [];

  for (const line of stored) {
    const product = findProduct(catalog, line.productId);
    // What the shopper saw when they added it, or failing that what the shop calls it now.
    const name = (typeof line.name === "string" && line.name) || product?.name || "An item";
    const shadeName =
      (typeof line.variantName === "string" && line.variantName) ||
      product?.variants?.find((v) => v.id === line.variantId)?.name;
    const shade = shadeName ? ` (${shadeName})` : "";
    const [kept] = reconcileCart([line], catalog);
    const asked = Math.max(1, Math.floor(line.quantity));

    if (!kept) {
      notes.push(
        product
          ? `${name}${shade} has sold out, so it was taken out of your bag.`
          : `${name}${shade} is no longer available, so it was taken out of your bag.`
      );
    } else if (kept.quantity < asked) {
      notes.push(
        kept.stock > MAX_PER_ITEM && kept.quantity === MAX_PER_ITEM
          ? `${name}${shade}: one order can hold at most ${MAX_PER_ITEM}, so your bag now has ${kept.quantity}.`
          : `${name}${shade}: only ${kept.quantity} left, so your bag now has ${kept.quantity}.`
      );
    }
  }

  return notes;
}

// What is saved, unchecked. Run it through reconcileCart before showing or trusting it.
export function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  if (memoryOnly) return cache.parsed;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    memoryOnly = true;
    return cache.parsed;
  }

  // Keep the same array identity until the stored value changes.
  if (raw === cache.raw) return cache.parsed;

  let parsed = EMPTY_CART;
  try {
    const data = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) parsed = data.filter(looksLikeItem);
  } catch {
    parsed = EMPTY_CART;
  }

  cache = { raw, parsed };
  return parsed;
}

export function writeCart(items: CartItem[]) {
  const raw = JSON.stringify(items);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    memoryOnly = true;
  }
  cache = { raw, parsed: items };
  listeners.forEach((listener) => listener());
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function clearCart() {
  writeCart([]);
}

// The changes below take the current, reconciled lines and return the new ones.

export function withAdded(items: CartItem[], item: Omit<CartItem, "quantity">): CartItem[] {
  const existing = items.find((i) => i.id === item.id);

  if (existing) {
    return items.map((i) =>
      i.id === item.id ? { ...i, quantity: Math.min(i.quantity + 1, lineLimit(i.stock)) } : i
    );
  }

  return lineLimit(item.stock) > 0 ? [...items, { ...item, quantity: 1 }] : items;
}

export function withoutItem(items: CartItem[], id: string): CartItem[] {
  return items.filter((i) => i.id !== id);
}

export function withQuantity(items: CartItem[], id: string, quantity: number): CartItem[] {
  if (quantity <= 0) return withoutItem(items, id);
  return items.map((i) => (i.id === id ? { ...i, quantity: Math.min(quantity, lineLimit(i.stock)) } : i));
}
