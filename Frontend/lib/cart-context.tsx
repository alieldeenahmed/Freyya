"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCatalog } from "@/lib/catalog-context";
import {
  EMPTY_CART,
  clearCart,
  readStoredCart,
  reconcileCart,
  subscribeCart,
  withAdded,
  withQuantity,
  withoutItem,
  writeCart,
  type CartItem,
} from "@/lib/cart-store";

export type { CartItem };
export type AddedNotice = Omit<CartItem, "quantity"> & { stamp: number };

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  lastAdded: AddedNotice | null;
  clearLastAdded: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();

  // The cart lives in localStorage, so it survives reloads and syncs across tabs.
  // What is saved is checked against the current catalog every time it is read.
  const stored = useSyncExternalStore(subscribeCart, readStoredCart, () => EMPTY_CART);
  const items = useMemo(() => reconcileCart(stored, catalog), [stored, catalog]);

  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddedNotice | null>(null);

  const clearLastAdded = useCallback(() => setLastAdded(null), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const current = useCallback(() => reconcileCart(readStoredCart(), catalog), [catalog]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">) => {
      setLastAdded({ ...item, stamp: Date.now() });
      writeCart(withAdded(current(), item));
    },
    [current]
  );
  const removeItem = useCallback((id: string) => writeCart(withoutItem(current(), id)), [current]);
  const updateQuantity = useCallback(
    (id: string, quantity: number) => writeCart(withQuantity(current(), id, quantity)),
    [current]
  );

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        itemCount,
        lastAdded,
        clearLastAdded,
        addItem,
        removeItem,
        updateQuantity,
        clear: clearCart,
        open,
        close,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
