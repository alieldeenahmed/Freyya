"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
import SortMenu from "@/components/SortMenu";
import {
  DEFAULT_VIEW,
  GROUPS,
  SORTS,
  applyView,
  parseView,
  viewToQuery,
  type ShopView,
} from "@/lib/shop";
import type { Product } from "@/lib/types";

interface ShopLayoutProps {
  products: Product[];
  view: ShopView;
  onChange: (next: Partial<ShopView>) => void;
}

function ShopLayout({ products, view, onChange }: ShopLayoutProps) {
  const visible = applyView(products, view);

  return (
    <>
      <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const active = view.group === group.id;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ group: group.id })}
                className={`min-h-11 border px-5 text-xs uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? "border-text bg-text text-base"
                    : "border-secondary/60 text-text/70 hover:border-accent hover:text-accent-deep"
                }`}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-end justify-between gap-6 sm:justify-end">
          <p role="status" className="pb-3 text-xs text-text/65">
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </p>
          <SortMenu
            label="Sort by"
            options={SORTS}
            value={view.sort}
            onChange={(sort) => onChange({ sort })}
          />
        </div>
      </div>

      <div className="mt-12">
        <ProductGrid products={visible} />
      </div>
    </>
  );
}

export default function ShopBrowser({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = parseView(useSearchParams());

  // The choice lives in the URL so it survives back, reload and sharing.
  const update = (next: Partial<ShopView>) => {
    router.replace(`${pathname}${viewToQuery({ ...view, ...next })}`, { scroll: false });
  };

  return <ShopLayout products={products} view={view} onChange={update} />;
}

// Shown while the URL is being read. Same markup, so nothing shifts when it is replaced.
export function ShopBrowserFallback({ products }: { products: Product[] }) {
  return <ShopLayout products={products} view={DEFAULT_VIEW} onChange={() => {}} />;
}
