"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await apiFetch("/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
