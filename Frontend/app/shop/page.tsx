import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
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
        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              headingLevel="h2"
              priority={index < 3}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
