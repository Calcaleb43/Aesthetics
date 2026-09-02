"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export function ParallaxImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const viewH = window.innerHeight || 1;
      const progress = Math.min(1, Math.max(0, 1 - rect.top / viewH));
      const offset = (progress - 0.5) * 48;
      node.style.setProperty("--parallax", `${offset}px`);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className={`object-cover object-center will-change-transform ${className}`}
        style={{ transform: "translate3d(0, var(--parallax, 0px), 0) scale(1.12)" }}
      />
    </div>
  );
}
