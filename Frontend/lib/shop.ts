import type { Product, ProductCategory } from "@/lib/types";

export type ShopGroup = "all" | "skincare" | "color";
export type ShopSort = "featured" | "price-asc" | "price-desc" | "name";

export interface ShopView {
  group: ShopGroup;
  sort: ShopSort;
}

export const DEFAULT_VIEW: ShopView = { group: "all", sort: "featured" };

export const GROUPS: { id: ShopGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "skincare", label: "Skincare" },
  { id: "color", label: "Color" },
];

export const SORTS: { id: ShopSort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "name", label: "Name" },
];

const COLOR_CATEGORIES: ProductCategory[] = ["Lip Balm", "Highlighter"];

export function groupOf(product: Product): Exclude<ShopGroup, "all"> {
  return COLOR_CATEGORIES.includes(product.category) ? "color" : "skincare";
}

// Anything that isn't a known option falls back to the default, so a mistyped
// or old link still shows the whole shop.
export function parseView(params: { get(name: string): string | null }): ShopView {
  const group = GROUPS.find((g) => g.id === params.get("group"));
  const sort = SORTS.find((s) => s.id === params.get("sort"));
  return { group: group?.id ?? DEFAULT_VIEW.group, sort: sort?.id ?? DEFAULT_VIEW.sort };
}

export function applyView(products: Product[], view: ShopView): Product[] {
  const shown =
    view.group === "all" ? [...products] : products.filter((p) => groupOf(p) === view.group);

  switch (view.sort) {
    case "price-asc":
      return shown.sort((a, b) => a.price - b.price);
    case "price-desc":
      return shown.sort((a, b) => b.price - a.price);
    case "name":
      return shown.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return shown;
  }
}

// Only what differs from the default goes in the URL.
export function viewToQuery(view: ShopView): string {
  const params = new URLSearchParams();
  if (view.group !== DEFAULT_VIEW.group) params.set("group", view.group);
  if (view.sort !== DEFAULT_VIEW.sort) params.set("sort", view.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}
