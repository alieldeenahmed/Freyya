"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

// Fades the photo in once it has loaded, revealing the parent's `.skeleton` until then.
export default function FadeImage({ alt, className = "", onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  // Cached images can finish before hydration, so onLoad alone would miss them.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <Image
      {...props}
      alt={alt}
      ref={ref}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={`${className} transition-opacity duration-500 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
