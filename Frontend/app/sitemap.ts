import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    { path: "", priority: 1 },
    { path: "/shop", priority: 0.9 },
    { path: "/quiz", priority: 0.7 },
    { path: "/about", priority: 0.6 },
    { path: "/contact", priority: 0.4 },
    { path: "/shipping-returns", priority: 0.4 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ];

  const products = (await getCatalog()).map((product) => ({
    path: `/shop/${product.id}`,
    priority: 0.8,
  }));

  return [...pages, ...products].map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    priority,
  }));
}
