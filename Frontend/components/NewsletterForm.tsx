"use client";

import { useEffect, useRef, useState } from "react";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const thanksRef = useRef<HTMLDivElement>(null);

  // The form is replaced by the thank-you, which would drop focus. Move it to the message.
  useEffect(() => {
    if (done) thanksRef.current?.focus();
  }, [done]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!EMAIL.test(email.trim())) {
      setError("Enter a valid email address.");
      document.getElementById("newsletter-email")?.focus();
      return;
    }

    setError("");
    setDone(true);
  };

  if (done) {
    return (
      <div ref={thanksRef} role="status" tabIndex={-1} className="max-w-sm outline-none">
        <p className="font-serif text-xl text-text">Thank you.</p>
        <p className="mt-2 text-sm text-text/70">
          This is a demonstration, so your address wasn&apos;t saved and nothing will be sent.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Newsletter" className="max-w-sm">
      <label htmlFor="newsletter-email" className="text-xs uppercase tracking-widest text-text/65">
        The list
      </label>
      <p className="mt-2 text-sm text-text/70">New shades and restocks. Rarely more.</p>

      <div className="mt-4 flex items-end gap-4 border-b border-secondary/60 transition-colors focus-within:border-accent">
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "newsletter-email-error" : undefined}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text placeholder:text-text/65 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 py-3 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:text-accent-deep"
        >
          Join
        </button>
      </div>

      {error && (
        <p id="newsletter-email-error" role="alert" className="mt-2 text-xs text-accent-deep">
          {error}
        </p>
      )}
    </form>
  );
}
