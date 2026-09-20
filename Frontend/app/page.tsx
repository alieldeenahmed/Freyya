import type { Metadata } from "next";
import Hero from "@/components/Hero";
import ProductShowcase from "@/components/ProductShowcase";
import BrandValues from "@/components/BrandValues";
import { getCatalog } from "@/lib/catalog";
import { findProduct } from "@/lib/products";

// The title and description come from the root layout. Only the canonical address is added here.
export const metadata: Metadata = { alternates: { canonical: "/" } };

const SHOWCASE_IDS = ["golden-hour-serum", "dawn-cleanse", "second-skin-cream"];

export default async function Home() {
  const catalog = await getCatalog();

  return (
    <>
      <Hero />
      {SHOWCASE_IDS.map((id) => {
        const product = findProduct(catalog, id);
        return product ? (
          <ProductShowcase key={id} product={product} />
        ) : null;
      })}
      <BrandValues />
    </>
  );
}
