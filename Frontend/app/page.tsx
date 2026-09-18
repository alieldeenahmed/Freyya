import Hero from "@/components/Hero";
import ProductShowcase from "@/components/ProductShowcase";
import BrandValues from "@/components/BrandValues";
import { getCatalog } from "@/lib/catalog";
import { findProduct } from "@/lib/products";

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
