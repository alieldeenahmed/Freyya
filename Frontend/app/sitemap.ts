import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1 },
    { path: "/shop", priority: 0.9 },
    { path: "/quiz", priority: 0.7 },
    { path: "/about", priority: 0.6 },
  ];

  const products = getAllProducts().map((product) => ({
    path: `/shop/${product.id}`,
    priority: 0.8,
  }));

  return [...pages, ...products].map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    priority,
  }));
}
