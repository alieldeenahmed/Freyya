import { DEMO_MODE, DEMO_NOTICE } from "@/lib/demo";

// A thin line at the top of every page of the public demo. It is not sticky, so it never covers
// the header, and it is part of the page, so it is read before anything else.
export default function DemoBanner({ forceOn = false }: { forceOn?: boolean }) {
  if (!DEMO_MODE && !forceOn) return null;

  return (
    <p
      role="note"
      data-demo-banner
      className="border-b border-secondary/40 bg-secondary/20 px-6 py-2 text-center text-[11px] leading-relaxed tracking-[0.08em] text-text/75 sm:px-10"
    >
      {DEMO_NOTICE}
    </p>
  );
}
