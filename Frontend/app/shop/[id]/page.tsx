import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { findProduct, getRelatedProducts, isInStock } from "@/lib/products";
import { getReviews, summarize } from "@/lib/reviews";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Product } from "@/lib/types";
import ProductDetail from "@/components/ProductDetail";
import ProductReviews from "@/components/ProductReviews";
import RelatedProducts from "@/components/RelatedProducts";

// Only the products that existed at build time have pages. Anything else is a real
// 404 response. Without this, an unknown id would render the not-found design but
// answer 200, because the response has already started streaming by then.
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getCatalog()).map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = findProduct(await getCatalog(), id);
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
      images: [
        {
          url: `/shop/${product.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${product.name} by ${SITE_NAME}, $${product.price}`,
        },
      ],
    },
  };
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
      availability: isInStock(product)
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
  const catalog = await getCatalog();
  const product = findProduct(catalog, id);

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
      <RelatedProducts products={getRelatedProducts(catalog, product.id)} />
    </div>
  );
}
