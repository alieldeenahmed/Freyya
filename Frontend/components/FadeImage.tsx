"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

type Phase = "visible" | "loading" | "loaded";

// Images are visible in the server HTML so they can paint before any script runs.
// If one is still downloading when the page hydrates, it is hidden and faded in
// once it arrives, revealing the parent's `.skeleton` in the meantime.
export default function FadeImage({ alt, className = "", onLoad, ...props }: ImageProps) {
  const [phase, setPhase] = useState<Phase>("visible");

  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img && !(img.complete && img.naturalWidth > 0)) {
      setPhase((current) => (current === "visible" ? "loading" : current));
    }
  }, []);

  return (
    <Image
      {...props}
      alt={alt}
      ref={ref}
      onLoad={(e) => {
        setPhase("loaded");
        onLoad?.(e);
      }}
      className={`${className} transition-opacity duration-500 ${
        phase === "loading" ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}
