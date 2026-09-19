import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { products } from "@/data/products";
import { CartProvider } from "@/lib/cart-context";
import { CatalogProvider } from "@/lib/catalog-context";
import type { Product } from "@/lib/types";

// Renders a component with the same providers the app wraps every page in.
export function renderWithProviders(ui: ReactElement, catalog: Product[] = products) {
  return render(
    <CatalogProvider products={catalog}>
      <CartProvider>{ui}</CartProvider>
    </CatalogProvider>
  );
}
