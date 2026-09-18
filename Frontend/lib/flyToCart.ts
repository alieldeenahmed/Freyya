import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";

const THUMB_W = 112;
const THUMB_H = 140;

// Launches a thumbnail from `from` into the header bag, then calls onArrive
// (which should actually add the item) as it lands.
export function flyToCart({
  from,
  src,
  onArrive,
}: {
  from: HTMLElement | null;
  src: string;
  onArrive: () => void;
}) {
  const target = document.querySelector<HTMLElement>("[data-cart-button]");

  if (!from || !target || prefersReducedMotion()) {
    onArrive();
    return;
  }

  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const startX = a.left + a.width / 2;
  const startY = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - startX;
  const dy = b.top + b.height / 2 - startY;

  const ghost = document.createElement("div");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX - THUMB_W / 2}px`,
    top: `${startY - THUMB_H / 2}px`,
    width: `${THUMB_W}px`,
    height: `${THUMB_H}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "60",
    background: "var(--color-secondary)",
    boxShadow: "0 12px 32px rgba(43, 36, 32, 0.18)",
    willChange: "transform, opacity",
  });
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  Object.assign(img.style, {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  });
  ghost.appendChild(img);
  document.body.appendChild(ghost);

  let arrived = false;
  const arrive = () => {
    if (arrived) return;
    arrived = true;
    ghost.remove();
    onArrive();
    gsap.fromTo(
      target,
      { scale: 1 },
      { scale: 1.2, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out", clearProps: "scale" }
    );
  };

  const tl = gsap.timeline({ onComplete: arrive });
  tl.fromTo(
    ghost,
    { scale: 0.5, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.2, ease: "back.out(1.6)" }
  )
    // x and y use different eases so the thumbnail arcs up, then sweeps in.
    .to(ghost, { x: dx, duration: 0.75, ease: "power2.in" }, ">0.05")
    .to(ghost, { y: dy, duration: 0.75, ease: "power3.out" }, "<")
    .to(ghost, { scale: 0.2, opacity: 0.5, duration: 0.75, ease: "power2.in" }, "<");

  // Never leave the item un-added if the animation is interrupted.
  window.setTimeout(arrive, 2500);
}
