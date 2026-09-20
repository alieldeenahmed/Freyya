import { beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { findProduct } from "@/lib/products";
import {
  MAX_PER_ITEM,
  explainChanges,
  lineLimit,
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
    expect(items.map((i) => i.id)).toEqual(["freyya-balm:bare"]);
  });

  it("uses whatever catalog it is given", () => {
    expect(reconcileCart([base], [])).toEqual([]);
  });
});

describe("the most of one item a bag can hold", () => {
  const cleanse = { id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 } as CartItem;

  it("is the smaller of the stock and what one order can hold", () => {
    expect(MAX_PER_ITEM).toBe(10);
    expect(lineLimit(24)).toBe(10);
    expect(lineLimit(3)).toBe(3);
    expect(lineLimit(0)).toBe(0);
  });

  it("cuts a saved quantity down to it, even when there is plenty in stock", () => {
    // Dawn Cleanse has 24 in stock, but the API refuses more than ten of one item.
    expect(reconcileCart([{ ...cleanse, quantity: 24 }], products)[0].quantity).toBe(10);
  });

  it("stops adding and raising the quantity at it", () => {
    const line: Omit<CartItem, "quantity"> = {
      id: cleanse.id,
      productId: cleanse.productId,
      price: 28,
      name: "Dawn Cleanse",
      color: "#fff",
      image: "/x.jpg",
      stock: 24,
    };
    let bag: CartItem[] = [];
    for (let i = 0; i < 15; i++) bag = withAdded(bag, line);
    expect(bag[0].quantity).toBe(10);
    expect(withQuantity(bag, "dawn-cleanse", 20)[0].quantity).toBe(10);
  });
});

describe("a saved cart with damaged or old contents", () => {
  const line = (over: Partial<CartItem>) => ({ id: "veil-spf", productId: "veil-spf", quantity: 1, ...over }) as CartItem;

  it("merges two lines for the same item into one, within the stock", () => {
    const merged = reconcileCart([line({ quantity: 3 }), line({ quantity: 4 })], products);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(7);

    const over = reconcileCart([line({ quantity: 8 }), line({ quantity: 8 })], products);
    expect(over[0].quantity).toBe(10);
  });

  it("merges the same shade saved under two different ids", () => {
    const bag = reconcileCart(
      [
        line({ id: "freyya-balm:petal", productId: "freyya-balm", variantId: "petal", quantity: 1 }),
        line({ id: "old-style-id", productId: "freyya-balm", variantId: "petal", quantity: 2 }),
      ],
      products
    );
    expect(bag).toHaveLength(1);
    expect(bag[0]).toMatchObject({ id: "freyya-balm:petal", quantity: 3 });
  });

  it("rebuilds the id from the catalog instead of trusting the saved one", () => {
    const [fixed] = reconcileCart([line({ id: "whatever-was-saved" })], products);
    expect(fixed.id).toBe("veil-spf");
    const [shade] = reconcileCart([line({ id: "x", productId: "freyya-balm", variantId: "bare" })], products);
    expect(shade.id).toBe("freyya-balm:bare");
  });

  it("ignores a shade on a product that has none", () => {
    const [fixed] = reconcileCart([line({ variantId: "petal" })], products);
    expect(fixed.id).toBe("veil-spf");
    expect(fixed.variantId).toBeUndefined();
  });

  it.each([0, -3, 0.2, 1e21, Number.MAX_SAFE_INTEGER])("makes sense of a quantity of %s", (quantity) => {
    const result = reconcileCart([line({ quantity })], products);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBeGreaterThanOrEqual(1);
    expect(result[0].quantity).toBeLessThanOrEqual(10);
    expect(Number.isInteger(result[0].quantity)).toBe(true);
  });

  it("never returns more than the stock, or a line for something sold out", () => {
    const sold = products.map((p) => ({ ...p, stock: 0, variants: p.variants?.map((v) => ({ ...v, stock: 0 })) }));
    expect(reconcileCart([line({ quantity: 2 })], sold)).toEqual([]);
  });
});

describe("explaining what changed in a saved bag", () => {
  const line = (over: Partial<CartItem>) =>
    ({ id: "veil-spf", productId: "veil-spf", name: "Veil SPF", quantity: 1, ...over }) as CartItem;

  it("says nothing when the bag is still good", () => {
    expect(explainChanges([line({ quantity: 2 })], products)).toEqual([]);
  });

  it("says an item is gone when the shop no longer has it", () => {
    expect(explainChanges([line({ productId: "discontinued", name: "Old Cream" })], products)).toEqual([
      "Old Cream is no longer available, so it was taken out of your bag.",
    ]);
  });

  it("says an item sold out, naming the shade", () => {
    const sold = products.map((p) =>
      p.id === "freyya-balm" ? { ...p, variants: p.variants?.map((v) => (v.id === "petal" ? { ...v, stock: 0 } : v)) } : p
    );
    const notes = explainChanges(
      [line({ id: "freyya-balm:petal", productId: "freyya-balm", variantId: "petal", name: "Freyya Balm", variantName: "Petal" })],
      sold
    );
    expect(notes).toEqual(["Freyya Balm (Petal) has sold out, so it was taken out of your bag."]);
  });

  it("says how many are left when the bag had more", () => {
    expect(explainChanges([line({ id: "golden-hour-serum", productId: "golden-hour-serum", name: "Golden Hour Serum", quantity: 9 })], products)).toEqual([
      "Golden Hour Serum: only 3 left, so your bag now has 3.",
    ]);
  });

  it("explains the limit per order separately from running out", () => {
    expect(explainChanges([line({ id: "dawn-cleanse", productId: "dawn-cleanse", name: "Dawn Cleanse", quantity: 24 })], products)).toEqual([
      "Dawn Cleanse: one order can hold at most 10, so your bag now has 10.",
    ]);
  });

  it("copes with damaged lines without throwing", () => {
    expect(() => explainChanges([{ id: "x", productId: "veil-spf", quantity: 1 } as CartItem], products)).not.toThrow();
    expect(explainChanges([{ id: "x", productId: "nope", quantity: 1 } as CartItem], products)[0]).toMatch(/^An item is no longer available/);
  });
});
