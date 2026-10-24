import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { currentAdmin } from "@/lib/admin-api";
import { DEMO_DETAILS_URL, DEMO_MODE } from "@/lib/demo";

export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect("/admin");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest text-accent-deep">Freyya admin</p>
        <h1 className="mt-2 font-serif text-4xl text-text">Sign in</h1>
        {DEMO_MODE && (
          <p className="mt-4 text-sm leading-relaxed text-text/70">
            This is the public demo. Its sign-in details are published in the{" "}
            <a
              href={DEMO_DETAILS_URL}
              className="border-b border-accent text-text transition-colors hover:text-accent-deep"
            >
              project README
            </a>
            .
          </p>
        )}
        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
