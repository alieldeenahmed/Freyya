import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteShell from "@/components/SiteShell";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import { CartProvider } from "@/lib/cart-context";
import { getCatalogState } from "@/lib/catalog";
import { CatalogProvider } from "@/lib/catalog-context";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Colours the browser's own bar on a phone to match the page.
export const viewport: Viewport = { themeColor: "#f7f3ee" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { products: catalog, live } = await getCatalogState();

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}
    >
      {/* data-catalog says where the products came from: the API, or the bundled snapshot. */}
      <body className="min-h-full flex flex-col" data-catalog={live ? "live" : "snapshot"}>
        <CatalogProvider products={catalog} live={live}>
          <CartProvider>
            <SmoothScrollProvider>
              <SiteShell header={<Header />} footer={<Footer />}>
                {children}
              </SiteShell>
            </SmoothScrollProvider>
          </CartProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
