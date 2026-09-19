"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field, fieldClass } from "@/components/Field";

type Fields = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MESSAGE_MAX = 1000;

export default function ContactForm() {
  const [fields, setFields] = useState<Fields>({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const thanksRef = useRef<HTMLDivElement>(null);

  // The form is replaced by the thank-you, which would drop focus. Move it to the message.
  useEffect(() => {
    if (sentTo) thanksRef.current?.focus();
  }, [sentTo]);

  const set =
    (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const validate = (): Errors => {
    const next: Errors = {};
    if (fields.name.trim().length < 2) next.name = "Enter your name.";
    if (!EMAIL.test(fields.email.trim())) next.email = "Enter a valid email address.";
    if (fields.message.trim().length < 10) next.message = "Write a few words so we can help.";
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }

    setSentTo(fields.name.trim().split(" ")[0]);
  };

  const input = (key: keyof Fields) => ({
    id: `contact-${key}`,
    value: fields[key],
    onChange: set(key),
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `contact-${key}-error` : undefined,
    className: fieldClass,
  });

  if (sentTo) {
    return (
      <div ref={thanksRef} role="status" tabIndex={-1} className="outline-none">
        <h2 className="font-serif text-3xl text-text">Thank you, {sentTo}.</h2>
        <p className="mt-4 max-w-sm text-text/70">
          In a live store this would reach our team. This is a demonstration, so nothing was
          sent.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link
            href="/shop"
            className="border border-text px-8 py-3 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:border-accent hover:text-accent-deep"
          >
            Continue shopping
          </Link>
          <button
            type="button"
            onClick={() => {
              setFields({ name: "", email: "", message: "" });
              setSentTo(null);
            }}
            className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Contact" className="space-y-8">
      <Field id="contact-name" label="Name" error={errors.name}>
        <input {...input("name")} autoComplete="name" />
      </Field>
      <Field id="contact-email" label="Email" error={errors.email}>
        <input {...input("email")} type="email" autoComplete="email" />
      </Field>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea
          {...input("message")}
          rows={5}
          maxLength={MESSAGE_MAX}
          placeholder="Ask about an order, a shade or an ingredient."
          className={`${fieldClass} resize-none`}
        />
      </Field>

      <button
        type="submit"
        className="w-full border border-text bg-text py-4 text-center text-sm uppercase tracking-[0.2em] text-base transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-text sm:w-auto sm:px-12"
      >
        Send message
      </button>
      <p className="text-[11px] leading-relaxed text-text/65">
        Demo form: nothing you type here is sent or stored.
      </p>
    </form>
  );
}
