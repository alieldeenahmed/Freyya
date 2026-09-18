import type { ReactNode } from "react";

export const fieldClass =
  "w-full border-0 border-b border-secondary/60 bg-transparent py-3 text-text placeholder:text-text/30 transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-accent";

const labelClass = "text-[11px] uppercase tracking-[0.2em] text-text/60";

export function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional && <span className="text-text/40"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
