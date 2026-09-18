import type Lenis from "lenis";

// Lets other components pause smooth scrolling (e.g. while the cart is open).
let instance: Lenis | null = null;

export const setLenis = (lenis: Lenis | null) => {
  instance = lenis;
};

export const getLenis = () => instance;
