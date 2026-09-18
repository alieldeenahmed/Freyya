import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { toApiError } from "@/lib/api";
import { API_URL } from "@/lib/catalog";

export const ADMIN_COOKIE = "freyya_admin";

// Server-side calls to the admin API, made as the signed-in admin by passing their
// session cookie along. Not signed in, or a session that has run out, means the login page.
export async function adminFetch<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) redirect("/admin/login");

  const res = await fetch(`${API_URL}/admin${path}`, {
    headers: { cookie: `${ADMIN_COOKIE}=${token}` },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/admin/login");
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export async function requireAdmin(): Promise<{ email: string }> {
  const { admin } = await adminFetch<{ admin: { email: string } }>("/me");
  return admin;
}

// For the login page: is there already a working session?
export async function currentAdmin(): Promise<{ email: string } | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      headers: { cookie: `${ADMIN_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()) as { admin: { email: string } }).admin;
  } catch {
    return null;
  }
}
