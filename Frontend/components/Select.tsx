"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption<T extends string> {
  id: T;
  label: string;
}

interface SelectProps<T extends string> {
  // Gives the button an id, so a <label htmlFor> elsewhere on the page can name it.
  id?: string;
  // Names the list for screen readers, and is shown above the button in the "menu" style.
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // "field" sits in a form like the underline inputs. "menu" is a small labelled control.
  variant?: "field" | "menu";
  className?: string;
}

const MAX_LIST_HEIGHT = 256;
const ROW_HEIGHT = 52;

// The site's own dropdown, in place of the browser's. It behaves like a native one:
// arrow keys, Home and End, Enter or Space to choose, Escape to close, and typing
// a letter jumps to the next option that starts with it.
export default function Select<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  variant = "field",
  className = "",
}: SelectProps<T>) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const buttonId = id ?? `${uid}-button`;
  const optionId = (index: number) => `${uid}-option-${index}`;
  const isMenu = variant === "menu";

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const [dropUp, setDropUp] = useState(false);

  const openMenu = () => {
    // Open upward when the list would run off the bottom of the screen and there is more room above.
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const listHeight = Math.min(MAX_LIST_HEIGHT, options.length * ROW_HEIGHT + 16);
      const below = window.innerHeight - rect.bottom;
      setDropUp(below < listHeight && rect.top > below);
    }
    setActive(selectedIndex);
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.id);
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

  // Keep the highlighted option in view in a long list.
  useEffect(() => {
    if (open) document.getElementById(`${uid}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

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
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        return;
      case "Tab":
        setOpen(false);
        return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const letter = e.key.toLowerCase();
      for (let step = 1; step <= options.length; step++) {
        const index = (active + step) % options.length;
        if (options[index]?.label.toLowerCase().startsWith(letter)) {
          setActive(index);
          break;
        }
      }
    }
  };

  const triggerClass = isMenu
    ? "mt-1 py-2 font-serif text-lg"
    : "py-3 text-base";

  return (
    <div ref={rootRef} className={`relative ${isMenu ? "w-56" : "w-full"} ${className}`}>
      {isMenu && (
        <span id={labelId} className="block text-[11px] uppercase tracking-[0.2em] text-text/65">
          {label}
        </span>
      )}

      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-labelledby={isMenu ? `${labelId} ${buttonId}` : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={`flex w-full items-center justify-between gap-4 border-b text-left text-text transition-colors hover:border-accent ${triggerClass} ${
          open ? "border-accent" : "border-secondary/60"
        }`}
      >
        <span className="truncate">{options[selectedIndex]?.label}</span>
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
          id={`${uid}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={isMenu ? undefined : label}
          aria-labelledby={isMenu ? labelId : undefined}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          data-lenis-prevent
          className={`absolute left-0 right-0 z-30 max-h-64 ${dropUp ? "bottom-full mb-2" : "top-full mt-2"} animate-[menu-in_0.22s_ease-out] scroll-thin overflow-y-auto overscroll-contain border border-secondary/60 bg-base py-2 shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:outline-none motion-reduce:animate-none`}
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
