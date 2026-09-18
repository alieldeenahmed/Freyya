import { beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { findProduct } from "@/lib/products";
import {
  reconcileCart,
  withAdded,
  withQuantity,
  withoutItem,
  type CartItem,
} from "@/lib/cart-store";

const KEY = "freyya:cart";

type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

// The store keeps module-level state, so each test loads a fresh copy
// against a fresh fake browser.
async function loadStore(storage: Storage = fakeStorage()) {
  vi.resetModules();
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return { storage, store: await import("@/lib/cart-store") };
}

function lineFor(productId: string, variantId?: string): Omit<CartItem, "quantity"> {
  const product = findProduct(products, productId)!;
  const variant = product.variants?.find((v) => v.id === variantId);
  return {
    id: variant ? `${productId}:${variant.id}` : productId,
    productId,
    variantId: variant?.id,
    name: product.name,
    variantName: variant?.name,
    price: product.price,
    color: variant?.hex ?? product.color,
    image: variant?.image ?? product.image,
    stock: variant?.stock ?? product.stock ?? 0,
  };
}

const line = (productId: string, quantity: number, variantId?: string): CartItem => ({
  ...lineFor(productId, variantId),
  quantity,
});

const saved = (items: unknown[]) => JSON.stringify(items);

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("adding and changing items", () => {
  it("adds a new item with quantity 1", () => {
    expect(withAdded([], lineFor("dawn-cleanse"))).toMatchObject([
      { productId: "dawn-cleanse", quantity: 1 },
    ]);
  });

  it("increments when the same item is added again", () => {
    let items: CartItem[] = [];
    items = withAdded(items, lineFor("dawn-cleanse"));
    items = withAdded(items, lineFor("dawn-cleanse"));
    expect(items[0].quantity).toBe(2);
  });

  it("stops adding at the stock limit", () => {
    let items: CartItem[] = [];
    for (let i = 0; i < 6; i++) items = withAdded(items, lineFor("golden-hour-serum"));
    expect(items[0].quantity).toBe(3);
  });

  it("limits each shade by its own stock", () => {
    let items: CartItem[] = [];
    for (let i = 0; i < 5; i++) items = withAdded(items, lineFor("freyya-balm", "terracotta"));
    for (let i = 0; i < 5; i++) items = withAdded(items, lineFor("freyya-balm", "bare"));
    const byShade = Object.fromEntries(items.map((i) => [i.variantId, i.quantity]));
    expect(byShade).toEqual({ terracotta: 2, bare: 5 });
  });

  it("ignores an item with no stock", () => {
    expect(withAdded([], { ...lineFor("dawn-cleanse"), stock: 0 })).toEqual([]);
  });

  it("clamps a quantity change to stock", () => {
    const items = withQuantity([line("golden-hour-serum", 1)], "golden-hour-serum", 10);
    expect(items[0].quantity).toBe(3);
  });

  it("removes an item when its quantity drops to zero", () => {
    expect(withQuantity([line("dawn-cleanse", 2)], "dawn-cleanse", 0)).toEqual([]);
  });

  it("removes one item and leaves the rest", () => {
    const items = withoutItem([line("dawn-cleanse", 1), line("veil-spf", 1)], "dawn-cleanse");
    expect(items.map((i) => i.id)).toEqual(["veil-spf"]);
  });

  it("does not change the list it is given", () => {
    const items = [line("dawn-cleanse", 1)];
    withAdded(items, lineFor("dawn-cleanse"));
    withQuantity(items, "dawn-cleanse", 5);
    withoutItem(items, "dawn-cleanse");
    expect(items).toEqual([line("dawn-cleanse", 1)]);
  });
});

describe("persistence", () => {
  it("survives a reload", async () => {
    const first = await loadStore();
    first.store.writeCart([line("dawn-cleanse", 2)]);

    const second = await loadStore(first.storage);
    expect(second.store.readStoredCart()).toMatchObject([
      { productId: "dawn-cleanse", quantity: 2 },
    ]);
  });

  it("keeps the same array until something changes", async () => {
    const { store } = await loadStore();
    store.writeCart([line("dawn-cleanse", 1)]);
    expect(store.readStoredCart()).toBe(store.readStoredCart());
  });

  it("notifies subscribers on change", async () => {
    const { store } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeCart(listener);

    store.writeCart([line("dawn-cleanse", 1)]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.clearCart();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears", async () => {
    const { store } = await loadStore();
    store.writeCart([line("dawn-cleanse", 1)]);
    store.clearCart();
    expect(store.readStoredCart()).toEqual([]);
  });

  it("still works when storage is unavailable", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    const { store } = await loadStore(broken);
    store.writeCart([line("dawn-cleanse", 1)]);
    expect(store.readStoredCart()).toMatchObject([{ productId: "dawn-cleanse", quantity: 1 }]);
  });

  it("ignores entries that are not cart items", async () => {
    const { store } = await loadStore(
      fakeStorage({ [KEY]: saved([null, "text", 4, { id: 1 }, line("dawn-cleanse", 1)]) })
    );
    expect(store.readStoredCart()).toHaveLength(1);
  });

  it("starts empty when the saved value is corrupt", async () => {
    for (const raw of ["{not json", '{"a":1}', "null", ""]) {
      const { store } = await loadStore(fakeStorage({ [KEY]: raw }));
      expect(store.readStoredCart()).toEqual([]);
    }
  });
});

describe("a saved cart is checked against the catalog", () => {
  const base = { id: "golden-hour-serum", productId: "golden-hour-serum", quantity: 1 } as CartItem;

  it("replaces a tampered price, name and stock", () => {
    const [item] = reconcileCart(
      [{ ...base, price: 1, name: "Free", stock: 999, image: "x" }],
      products
    );
    expect(item).toMatchObject({
      price: 58,
      name: "Golden Hour Serum",
      stock: 3,
      image: "/products/golden-hour-serum.jpg",
    });
  });

  it("follows the catalog when stock changes", () => {
    const lowStock = products.map((p) =>
      p.id === "golden-hour-serum" ? { ...p, stock: 1 } : p
    );
    const [item] = reconcileCart([{ ...base, quantity: 3 }], lowStock);
    expect(item).toMatchObject({ stock: 1, quantity: 1 });
  });

  it("drops an item that has sold out", () => {
    const soldOut = products.map((p) =>
      p.id === "golden-hour-serum" ? { ...p, stock: 0 } : p
    );
    expect(reconcileCart([base], soldOut)).toEqual([]);
  });

  it("clamps quantity to stock and to at least one", () => {
    expect(reconcileCart([{ ...base, quantity: 99 }], products)[0].quantity).toBe(3);
    expect(reconcileCart([{ ...base, quantity: -4 }], products)[0].quantity).toBe(1);
    expect(reconcileCart([{ ...base, quantity: 2.9 }], products)[0].quantity).toBe(2);
  });

  it("drops products and shades that no longer exist", () => {
    const items = reconcileCart(
      [
        { ...base, id: "ghost", productId: "ghost" },
        { ...base, id: "b:nope", productId: "freyya-balm", variantId: "nope" },
        { ...base, id: "balm", productId: "freyya-balm" },
        { ...base, id: "b:bare", productId: "freyya-balm", variantId: "bare" },
      ],
      products
    );
    expect(items.map((i) => i.id)).toEqual(["b:bare"]);
  });

  it("uses whatever catalog it is given", () => {
    expect(reconcileCart([base], [])).toEqual([]);
  });
});
