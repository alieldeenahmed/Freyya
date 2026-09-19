import { afterEach, vi } from "vitest";

vi.mock("next/navigation", () => import("./mocks/next-navigation"));

// Plain elements in place of the optimising image and link components.
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
      createElement("img", { src, alt, className }),
  };
});

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => createElement("a", { href, ...rest }, children),
  };
});

// Only browser-like environments need the rest.
if (typeof window !== "undefined") {
  // Report reduced motion, so components skip their GSAP animations and change state at once.
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};

  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.removeAttribute("style");
    const { resetNavigation } = await import("./mocks/next-navigation");
    resetNavigation();
  });
}
