import { useEffect, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

const MAX_PULL = 8;

export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.2) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      // Measure from the resting center. Using the moved box would make the
      // element chase the cursor and jitter.
      const restX = rect.left + rect.width / 2 - (gsap.getProperty(el, "x") as number);
      const restY = rect.top + rect.height / 2 - (gsap.getProperty(el, "y") as number);
      const pull = (delta: number) =>
        gsap.utils.clamp(-MAX_PULL, MAX_PULL, delta * strength);

      xTo(pull(e.clientX - restX));
      yTo(pull(e.clientY - restY));
    };

    const handleLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [ref, strength]);
}
