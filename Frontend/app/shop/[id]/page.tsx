import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProducts, getProductById, getRelatedProducts } from "@/lib/products";
import { getRatingSummary, getReviews } from "@/lib/reviews";
import ProductDetail from "@/components/ProductDetail";
import ProductReviews from "@/components/ProductReviews";
import RelatedProducts from "@/components/RelatedProducts";

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) return {};

  return {
    title: `${product.name} — Freyya`,
    description: product.tagline,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) notFound();

  const summary = getRatingSummary(product.id);

  return (
    // Keyed so moving between products resets the selected shade and state.
    <div key={product.id}>
      <ProductDetail product={product} rating={summary} />
      <ProductReviews
        productName={product.name}
        reviews={getReviews(product.id)}
        summary={summary}
      />
      <RelatedProducts products={getRelatedProducts(product.id)} />
    </div>
  );
}
