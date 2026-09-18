"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/Field";
import { ApiError, apiFetch } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      await apiFetch("/admin/login", { method: "POST", json: { email, password } });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : err instanceof ApiError
            ? err.message
            : "Could not sign in."
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8" aria-label="Admin sign in">
      <Field id="admin-email" label="Email">
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <Field id="admin-password" label="Password">
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-accent-deep">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full border border-text bg-text py-4 text-sm uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
