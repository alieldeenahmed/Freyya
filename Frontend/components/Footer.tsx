import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";
import { getCatalog } from "@/lib/catalog";

const EXPLORE = [
  { href: "/shop", label: "Shop all" },
  { href: "/quiz", label: "Find your shade" },
  { href: "/about", label: "About" },
];

const HELP = [
  { href: "/contact", label: "Contact" },
  { href: "/shipping-returns", label: "Shipping & returns" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const linkClass = "text-sm text-text/70 transition-colors hover:text-accent-deep";

export default async function Footer() {
  const products = await getCatalog();

  return (
    <footer className="border-t border-secondary/40 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-16">
          <div>
            <p className="font-serif text-3xl text-text">Freyya</p>
            <p className="mt-4 max-w-xs text-sm text-text/70">
              Formulated with intention. Nothing else.
            </p>
            <div className="mt-10">
              <NewsletterForm />
            </div>
          </div>

          <nav aria-label="Explore">
            <h2 className="text-xs uppercase tracking-widest text-text/65">Explore</h2>
            <ul className="mt-5 space-y-3">
              {EXPLORE.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Help">
            <h2 className="text-xs uppercase tracking-widest text-text/65">Help</h2>
            <ul className="mt-5 space-y-3">
              {HELP.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Products">
            <h2 className="text-xs uppercase tracking-widest text-text/65">The six</h2>
            <ul className="mt-5 space-y-3">
              {products.map((product) => (
                <li key={product.id}>
                  <Link href={`/shop/${product.id}`} className={linkClass}>
                    {product.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-16 border-t border-secondary/40 pt-6 text-xs text-text/65">
          &copy; {new Date().getFullYear()} Freyya
        </p>
      </div>
    </footer>
  );
}
