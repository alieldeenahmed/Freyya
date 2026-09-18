import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { currentAdmin } from "@/lib/admin-api";

export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect("/admin");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest text-accent-deep">Freyya admin</p>
        <h1 className="mt-2 font-serif text-4xl text-text">Sign in</h1>
        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
