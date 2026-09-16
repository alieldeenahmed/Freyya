import Hero from "@/components/Hero";
import ProductShowcase from "@/components/ProductShowcase";
import BrandValues from "@/components/BrandValues";
import { getProductById } from "@/lib/products";

const SHOWCASE_IDS = ["golden-hour-serum", "dawn-cleanse", "second-skin-cream"];

export default function Home() {
  return (
    <>
      <Hero />
      {SHOWCASE_IDS.map((id) => {
        const product = getProductById(id);
        return product ? (
          <ProductShowcase key={id} product={product} />
        ) : null;
      })}
      <BrandValues />
    </>
  );
}
