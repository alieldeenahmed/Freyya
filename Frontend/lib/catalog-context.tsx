"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Product } from "@/lib/types";

const CatalogContext = createContext<Product[] | null>(null);
const LiveContext = createContext(true);

// The server fetches the catalog once per page and hands it to everything in the browser
// that needs it: the cart, the quiz result and the product pages.
export function CatalogProvider({
  products,
  live = true,
  children,
}: {
  products: Product[];
  // False when these products are the bundled snapshot because the API could not be reached.
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <CatalogContext.Provider value={products}>
      <LiveContext.Provider value={live}>{children}</LiveContext.Provider>
    </CatalogContext.Provider>
  );
}

// Whether the catalog came from the API. When it did not, orders cannot be placed.
export function useCatalogLive(): boolean {
  return useContext(LiveContext);
}

export function useCatalog(): Product[] {
  const products = useContext(CatalogContext);
  if (!products) throw new Error("useCatalog must be used within CatalogProvider");
  return products;
}
