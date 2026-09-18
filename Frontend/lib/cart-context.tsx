"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  EMPTY_CART,
  addToCart,
  clearCart,
  getCartItems,
  removeFromCart,
  setCartQuantity,
  subscribeCart,
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
  // The cart lives in localStorage, so it survives reloads and syncs across tabs.
  const items = useSyncExternalStore(subscribeCart, getCartItems, () => EMPTY_CART);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddedNotice | null>(null);

  const clearLastAdded = useCallback(() => setLastAdded(null), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setLastAdded({ ...item, stamp: Date.now() });
    addToCart(item);
  }, []);

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
        removeItem: removeFromCart,
        updateQuantity: setCartQuantity,
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
