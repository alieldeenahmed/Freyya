import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProductById } from "@/lib/products";
import type { CartItem } from "@/lib/cart-store";

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
  const product = getProductById(productId)!;
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

const saved = (items: unknown[]) => JSON.stringify(items);

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("adding and changing items", () => {
  it("adds a new item with quantity 1", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("dawn-cleanse"));
    expect(store.getCartItems()).toMatchObject([{ productId: "dawn-cleanse", quantity: 1 }]);
  });

  it("increments when the same item is added again", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("dawn-cleanse"));
    store.addToCart(lineFor("dawn-cleanse"));
    expect(store.getCartItems()[0].quantity).toBe(2);
  });

  it("stops adding at the stock limit", async () => {
    const { store } = await loadStore();
    for (let i = 0; i < 6; i++) store.addToCart(lineFor("golden-hour-serum"));
    expect(store.getCartItems()[0].quantity).toBe(3);
  });

  it("limits each shade by its own stock", async () => {
    const { store } = await loadStore();
    for (let i = 0; i < 5; i++) store.addToCart(lineFor("freyya-balm", "terracotta"));
    for (let i = 0; i < 5; i++) store.addToCart(lineFor("freyya-balm", "bare"));
    const byShade = Object.fromEntries(store.getCartItems().map((i) => [i.variantId, i.quantity]));
    expect(byShade).toEqual({ terracotta: 2, bare: 5 });
  });

  it("ignores an item with no stock", async () => {
    const { store } = await loadStore();
    store.addToCart({ ...lineFor("dawn-cleanse"), stock: 0 });
    expect(store.getCartItems()).toEqual([]);
  });

  it("clamps a quantity change to stock", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("golden-hour-serum"));
    store.setCartQuantity("golden-hour-serum", 10);
    expect(store.getCartItems()[0].quantity).toBe(3);
  });

  it("removes an item when its quantity drops to zero", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("dawn-cleanse"));
    store.setCartQuantity("dawn-cleanse", 0);
    expect(store.getCartItems()).toEqual([]);
  });

  it("removes and clears", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("dawn-cleanse"));
    store.addToCart(lineFor("veil-spf"));
    store.removeFromCart("dawn-cleanse");
    expect(store.getCartItems().map((i) => i.id)).toEqual(["veil-spf"]);
    store.clearCart();
    expect(store.getCartItems()).toEqual([]);
  });
});

describe("persistence", () => {
  it("survives a reload", async () => {
    const first = await loadStore();
    first.store.addToCart(lineFor("dawn-cleanse"));
    first.store.addToCart(lineFor("dawn-cleanse"));

    const second = await loadStore(first.storage);
    expect(second.store.getCartItems()).toMatchObject([{ productId: "dawn-cleanse", quantity: 2 }]);
  });

  it("keeps the same array until something changes", async () => {
    const { store } = await loadStore();
    store.addToCart(lineFor("dawn-cleanse"));
    expect(store.getCartItems()).toBe(store.getCartItems());
  });

  it("notifies subscribers on change", async () => {
    const { store } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeCart(listener);
    store.addToCart(lineFor("dawn-cleanse"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.clearCart();
    expect(listener).toHaveBeenCalledTimes(1);
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
    store.addToCart(lineFor("dawn-cleanse"));
    expect(store.getCartItems()).toMatchObject([{ productId: "dawn-cleanse", quantity: 1 }]);
  });
});

describe("a saved cart is checked against the catalog", () => {
  const base = { id: "golden-hour-serum", productId: "golden-hour-serum", quantity: 1 };

  it("replaces a tampered price, name and stock", async () => {
    const { store } = await loadStore(
      fakeStorage({ [KEY]: saved([{ ...base, price: 1, name: "Free", stock: 999, image: "x" }]) })
    );
    expect(store.getCartItems()[0]).toMatchObject({
      price: 58,
      name: "Golden Hour Serum",
      stock: 3,
      image: "/products/golden-hour-serum.jpg",
    });
  });

  it("clamps quantity to stock and to at least one", async () => {
    const high = await loadStore(fakeStorage({ [KEY]: saved([{ ...base, quantity: 99 }]) }));
    expect(high.store.getCartItems()[0].quantity).toBe(3);

    const low = await loadStore(fakeStorage({ [KEY]: saved([{ ...base, quantity: -4 }]) }));
    expect(low.store.getCartItems()[0].quantity).toBe(1);

    const fraction = await loadStore(fakeStorage({ [KEY]: saved([{ ...base, quantity: 2.9 }]) }));
    expect(fraction.store.getCartItems()[0].quantity).toBe(2);
  });

  it("drops products and shades that no longer exist", async () => {
    const { store } = await loadStore(
      fakeStorage({
        [KEY]: saved([
          { id: "ghost", productId: "ghost", quantity: 1 },
          { id: "b:nope", productId: "freyya-balm", variantId: "nope", quantity: 1 },
          { id: "balm", productId: "freyya-balm", quantity: 1 },
          { id: "b:bare", productId: "freyya-balm", variantId: "bare", quantity: 1 },
        ]),
      })
    );
    expect(store.getCartItems().map((i) => i.id)).toEqual(["b:bare"]);
  });

  it("ignores entries that are not cart items", async () => {
    const { store } = await loadStore(
      fakeStorage({ [KEY]: saved([null, "text", 4, { id: 1 }, { ...base }]) })
    );
    expect(store.getCartItems()).toHaveLength(1);
  });

  it("starts empty when the saved value is corrupt", async () => {
    for (const raw of ["{not json", '{"a":1}', "null", ""]) {
      const { store } = await loadStore(fakeStorage({ [KEY]: raw }));
      expect(store.getCartItems()).toEqual([]);
    }
  });
});
