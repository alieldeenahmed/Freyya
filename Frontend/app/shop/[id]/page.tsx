import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllProducts,
  getProductById,
  getRelatedProducts,
  getStock,
} from "@/lib/products";
import { getReviews, summarize } from "@/lib/reviews";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Product } from "@/lib/types";
import ProductDetail from "@/components/ProductDetail";
import ProductReviews from "@/components/ProductReviews";
import RelatedProducts from "@/components/RelatedProducts";

export const dynamicParams = false;

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

  const description = `${product.tagline} ${product.description}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/${product.id}` },
    openGraph: {
      type: "website",
      title: `${product.name} — ${SITE_NAME}`,
      description,
      url: `/shop/${product.id}`,
    },
  };
}

function inStock(product: Product): boolean {
  if (product.variants) return product.variants.some((v) => getStock(product, v.id) > 0);
  return getStock(product) > 0;
}

function productJsonLd(product: Product, ratingSummary: ReturnType<typeof summarize>) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    image: [product.image, ...(product.variants?.map((v) => v.image) ?? [])].map(
      (src) => `${SITE_URL}${src}`
    ),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/shop/${product.id}`,
      priceCurrency: "USD",
      price: product.price,
      availability: inStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(ratingSummary.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: ratingSummary.average,
        reviewCount: ratingSummary.count,
      },
    }),
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

  const reviews = getReviews(product.id);
  const jsonLd = JSON.stringify(productJsonLd(product, summarize(reviews))).replace(
    /</g,
    "\\u003c"
  );

  return (
    // Keyed so moving between products resets the selected shade and state.
    <div key={product.id}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ProductDetail product={product} reviews={reviews} />
      <ProductReviews
        productId={product.id}
        productName={product.name}
        seeded={reviews}
        shades={product.variants?.map((variant) => variant.name)}
      />
      <RelatedProducts products={getRelatedProducts(product.id)} />
    </div>
  );
}
