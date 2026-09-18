import type { Metadata } from "next";

// A private tool: keep it out of search results and out of the store's own title format.
export const metadata: Metadata = {
  title: { absolute: "Admin — Freyya" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
