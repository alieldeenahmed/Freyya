import { Suspense } from "react";
import type { Metadata } from "next";
import ShopBrowser, { ShopBrowserFallback } from "@/components/ShopBrowser";
import { getAllProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Cleanser, serum, cream, SPF, lip balm and highlighter. Six products, nothing extra.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  const products = getAllProducts();

  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-4xl text-text sm:text-5xl">Shop</h1>
        <Suspense fallback={<ShopBrowserFallback products={products} />}>
          <ShopBrowser products={products} />
        </Suspense>
      </div>
    </div>
  );
}
