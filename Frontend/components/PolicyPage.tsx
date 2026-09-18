import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";

interface PolicyPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}

export default function PolicyPage({ eyebrow, title, intro, children }: PolicyPageProps) {
  return (
    <div className="px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="text-sm uppercase tracking-widest text-accent-deep">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl text-text sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-xl text-text/70">{intro}</p>
        </Reveal>

        <p className="mt-10 border-y border-secondary/40 py-4 text-xs text-text/65">
          Freyya is a demonstration store. This page shows how the policy would read in a live one.
        </p>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-secondary/40 py-10">
      <h2 className="font-serif text-2xl text-text">{title}</h2>
      <div className="mt-4 space-y-4 text-text/70 [&_a]:border-b [&_a]:border-accent [&_a]:text-text [&_a]:transition-colors [&_a:hover]:text-accent-deep [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
