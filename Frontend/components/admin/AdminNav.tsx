"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inventory", label: "Inventory" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex gap-6">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`border-b py-1 text-xs uppercase tracking-[0.2em] transition-colors ${
              active
                ? "border-accent text-text"
                : "border-transparent text-text/65 hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
