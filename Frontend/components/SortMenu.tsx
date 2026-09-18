"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Option<T extends string> {
  id: T;
  label: string;
}

interface SortMenuProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SortMenu<T extends string>({
  label,
  options,
  value,
  onChange,
}: SortMenuProps<T>) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const buttonId = `${uid}-button`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);

  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (index: number) => {
    onChange(options[index].id);
    closeMenu(true);
  };

  useEffect(() => {
    if (!open) return;

    listRef.current?.focus({ preventScroll: true });

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative w-56">
      <span id={labelId} className="block text-[11px] uppercase tracking-[0.2em] text-text/65">
        {label}
      </span>

      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${buttonId}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={`mt-1 flex w-full items-center justify-between border-b py-2 text-left font-serif text-lg text-text transition-colors hover:border-accent ${
          open ? "border-accent" : "border-secondary/60"
        }`}
      >
        {options[selectedIndex].label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`h-3 w-3 shrink-0 text-text/65 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="absolute left-0 right-0 top-full z-30 mt-2 animate-[menu-in_0.22s_ease-out] border border-secondary/60 bg-base py-2 shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:outline-none motion-reduce:animate-none"
        >
          {options.map((option, index) => {
            const selected = option.id === value;
            return (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                onClick={() => choose(index)}
                onMouseMove={() => active !== index && setActive(index)}
                className={`flex cursor-pointer items-center justify-between px-5 py-3 font-serif text-lg transition-colors ${
                  active === index ? "bg-secondary/20 text-text" : "text-text/70"
                }`}
              >
                {option.label}
                {selected && <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
