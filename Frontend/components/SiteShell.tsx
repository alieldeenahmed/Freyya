"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import CartDrawer from "@/components/CartDrawer";
import CartNotice from "@/components/CartNotice";

interface SiteShellProps {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

// The storefront frame: skip link, header, footer and the bag. The admin area
// is a separate tool and gets none of it.
export default function SiteShell({ header, footer, children }: SiteShellProps) {
  const isAdmin = usePathname().startsWith("/admin");

  if (isAdmin) {
    return (
      <div id="site-content" className="flex flex-1 flex-col">
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      {/* Made inert while the cart is open so focus cannot leave the drawer. */}
      <div id="site-content" className="flex flex-1 flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-text focus:px-4 focus:py-3 focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-base"
        >
          Skip to content
        </a>
        {header}
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        {footer}
      </div>
      <CartNotice />
      <CartDrawer />
    </>
  );
}
