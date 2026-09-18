"use client";

import { useId, useState } from "react";
import type { ProductDetails } from "@/lib/types";

type Section = { key: string; label: string; content: React.ReactNode };

export default function ProductAccordion({ details }: { details: ProductDetails }) {
  const [openKeys, setOpenKeys] = useState<string[]>(["ingredients"]);
  const baseId = useId();

  const sections: Section[] = [
    {
      key: "ingredients",
      label: "Ingredients",
      content: (
        <p className="text-sm leading-relaxed text-text/70">{details.ingredients}</p>
      ),
    },
    {
      key: "skin",
      label: "Skin type",
      content: (
        <ul className="flex flex-wrap gap-2">
          {details.skinTypes.map((type) => (
            <li
              key={type}
              className="border border-secondary/50 px-3 py-1 text-xs uppercase tracking-wide text-text/65"
            >
              {type}
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "size",
      label: "Size",
      content: <p className="text-sm text-text/70">{details.size}</p>,
    },
    {
      key: "usage",
      label: "Usage",
      content: (
        <p className="text-sm leading-relaxed text-text/70">{details.usage}</p>
      ),
    },
  ];

  const toggle = (key: string) =>
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  return (
    <div className="mt-10 max-w-sm border-t border-secondary/40">
      {sections.map((section) => {
        const open = openKeys.includes(section.key);
        const panelId = `${baseId}-${section.key}`;

        return (
          <div key={section.key} className="border-b border-secondary/40">
            <button
              type="button"
              onClick={() => toggle(section.key)}
              aria-expanded={open}
              aria-controls={panelId}
              className="group flex w-full items-center justify-between py-5 text-left"
            >
              <span className="text-xs uppercase tracking-[0.2em] text-text transition-colors group-hover:text-accent-deep">
                {section.label}
              </span>
              <span
                aria-hidden
                className="relative h-3 w-3 text-text/65 transition-colors group-hover:text-accent-deep"
              >
                <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
                <span
                  className={`absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current transition-transform duration-500 ease-out motion-reduce:transition-none ${
                    open ? "scale-y-0" : "scale-y-100"
                  }`}
                />
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="pb-6">{section.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
