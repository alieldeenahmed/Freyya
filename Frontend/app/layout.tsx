import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import CartDrawer from "@/components/CartDrawer";
import CartNotice from "@/components/CartNotice";
import { CartProvider } from "@/lib/cart-context";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <SmoothScrollProvider>
            {/* Made inert while the cart is open so focus cannot leave the drawer. */}
            <div id="site-content" className="flex flex-1 flex-col">
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-text focus:px-4 focus:py-3 focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-base"
              >
                Skip to content
              </a>
              <Header />
              <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {children}
              </main>
              <Footer />
            </div>
          </SmoothScrollProvider>
          <CartNotice />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
