"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Product } from "@/lib/types";

const CatalogContext = createContext<Product[] | null>(null);

// The server fetches the catalog once per page and hands it to everything in the browser
// that needs it: the cart, the quiz result and the product pages.
export function CatalogProvider({
  products,
  children,
}: {
  products: Product[];
  children: ReactNode;
}) {
  return <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Product[] {
  const products = useContext(CatalogContext);
  if (!products) throw new Error("useCatalog must be used within CatalogProvider");
  return products;
}
