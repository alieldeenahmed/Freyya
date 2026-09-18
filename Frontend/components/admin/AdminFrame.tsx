import type { ReactNode } from "react";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import SignOutButton from "@/components/admin/SignOutButton";
import { requireAdmin } from "@/lib/admin-api";

interface AdminFrameProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}

// The frame around every admin page. It also makes sure someone is signed in.
export default async function AdminFrame({ title, eyebrow, children }: AdminFrameProps) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-secondary/40 pb-6">
        <Link href="/admin" className="flex items-baseline gap-3">
          <span className="font-serif text-2xl text-text">Freyya</span>
          <span className="text-xs uppercase tracking-[0.2em] text-text/65">Admin</span>
        </Link>
        <AdminNav />
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
          >
            View store
          </Link>
          <span className="hidden text-xs text-text/65 sm:inline">{admin.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="py-10">
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-accent-deep">{eyebrow}</p>
        )}
        <h1 className="mt-2 font-serif text-4xl text-text">{title}</h1>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
