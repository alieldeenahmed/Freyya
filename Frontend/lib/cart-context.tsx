"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddedNotice | null>(null);

  const clearLastAdded = useCallback(() => setLastAdded(null), []);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setLastAdded({ ...item, stamp: Date.now() });
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i
        );
      }
      return item.stock > 0 ? [...prev, { ...item, quantity: 1 }] : prev;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) =>
            i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i
          )
    );
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
        removeItem,
        updateQuantity,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
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
