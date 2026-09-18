import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

const ORB_COUNT = 7;
const TRAVEL = 1.05;
const STAGGER = 0.05;

type Point = { x: number; y: number };

// A point on a quadratic curve from a to b, bent toward c.
function curve(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

// A gold light leaves `from`, glides into the header bag trailing fine dust,
// and a thin ring ripples out where it lands. onArrive adds the item.
export function flyToCart({
  from,
  onArrive,
}: {
  from: HTMLElement | null;
  onArrive: () => void;
}) {
  const target = document.querySelector<HTMLElement>("[data-cart-button]");

  if (!from || !target || prefersReducedMotion()) {
    onArrive();
    return;
  }

  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const start: Point = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const end: Point = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  // Rise first, then sweep across into the bag.
  const bend: Point = {
    x: start.x + (end.x - start.x) * 0.1,
    y: end.y + (start.y - end.y) * 0.2,
  };

  const orbs = Array.from({ length: ORB_COUNT }, (_, i) => {
    const size = 12 - i * 1.3;
    const orb = document.createElement("div");
    Object.assign(orb.style, {
      position: "fixed",
      left: `${-size / 2}px`,
      top: `${-size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      background:
        "radial-gradient(circle at 35% 35%, var(--color-glow), var(--color-accent) 65%)",
      boxShadow:
        "0 0 14px 2px color-mix(in srgb, var(--color-accent) 55%, transparent)",
      pointerEvents: "none",
      zIndex: "60",
      opacity: "0",
      willChange: "transform, opacity",
    });
    document.body.appendChild(orb);
    gsap.set(orb, { x: start.x, y: start.y });
    return orb;
  });

  let arrived = false;
  const cleanup = () => orbs.forEach((orb) => orb.remove());

  const arrive = () => {
    if (arrived) return;
    arrived = true;
    onArrive();

    const ring = document.createElement("div");
    Object.assign(ring.style, {
      position: "fixed",
      left: `${end.x - 22}px`,
      top: `${end.y - 22}px`,
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      border: "1px solid var(--color-accent)",
      pointerEvents: "none",
      zIndex: "60",
    });
    document.body.appendChild(ring);
    gsap.fromTo(
      ring,
      { scale: 0.5, opacity: 0.9 },
      {
        scale: 1.8,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        onComplete: () => ring.remove(),
      }
    );

    // A slow gold breath on the bag icon, not a bounce.
    const root = getComputedStyle(document.documentElement);
    target.style.transition = "none";
    gsap.fromTo(
      target,
      { color: root.getPropertyValue("--color-accent").trim() },
      {
        color: root.getPropertyValue("--color-text").trim(),
        duration: 1.2,
        ease: "power1.out",
        onComplete: () => {
          target.style.color = "";
          target.style.transition = "";
        },
      }
    );
  };

  orbs.forEach((orb, i) => {
    const lead = i === 0;
    const progress = { t: 0 };

    gsap.to(progress, {
      t: 1,
      duration: TRAVEL,
      delay: i * STAGGER,
      ease: "power2.inOut",
      onStart: () => {
        gsap.set(orb, { opacity: 1 - i * 0.11 });
      },
      onUpdate: () => {
        const p = curve(start, bend, end, progress.t);
        const fade = lead || progress.t < 0.85 ? 1 : (1 - progress.t) / 0.15;
        gsap.set(orb, {
          x: p.x,
          y: p.y,
          scale: 1 - progress.t * 0.35,
          opacity: (1 - i * 0.11) * fade,
        });
      },
      onComplete: () => {
        if (lead) {
          orb.remove();
          arrive();
        }
        if (i === ORB_COUNT - 1) cleanup();
      },
    });
  });

  // Never leave the item un-added, or particles behind, if interrupted.
  window.setTimeout(() => {
    arrive();
    cleanup();
  }, 3000);
}
