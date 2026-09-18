import { getProductById } from "@/lib/products";

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
    typeof v.quantity === "number"
  );
}

// Re-derive everything except identity and quantity from the live catalog, so a
// saved cart can never carry an outdated price, image or stock level.
function reconcile(items: CartItem[]): CartItem[] {
  return items.flatMap((item) => {
    const product = getProductById(item.productId);
    if (!product) return [];

    const variant = item.variantId
      ? product.variants?.find((v) => v.id === item.variantId)
      : undefined;
    if (product.variants && !variant) return [];

    const stock = variant ? variant.stock : (product.stock ?? 0);
    const quantity = Math.min(Math.max(1, Math.floor(item.quantity)), stock);
    if (quantity < 1) return [];

    return [
      {
        ...item,
        name: product.name,
        variantName: variant?.name,
        price: product.price,
        color: variant?.hex ?? product.color,
        image: variant?.image ?? product.image,
        stock,
        quantity,
      },
    ];
  });
}

export function getCartItems(): CartItem[] {
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
    if (Array.isArray(data)) parsed = reconcile(data.filter(looksLikeItem));
  } catch {
    parsed = EMPTY_CART;
  }

  cache = { raw, parsed };
  return parsed;
}

function write(items: CartItem[]) {
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

export function addToCart(item: Omit<CartItem, "quantity">) {
  const current = getCartItems();
  const existing = current.find((i) => i.id === item.id);

  if (existing) {
    write(
      current.map((i) =>
        i.id === item.id ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) } : i
      )
    );
    return;
  }

  if (item.stock > 0) write([...current, { ...item, quantity: 1 }]);
}

export function removeFromCart(id: string) {
  write(getCartItems().filter((i) => i.id !== id));
}

export function setCartQuantity(id: string, quantity: number) {
  const current = getCartItems();
  write(
    quantity <= 0
      ? current.filter((i) => i.id !== id)
      : current.map((i) => (i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i))
  );
}

export function clearCart() {
  write([]);
}
