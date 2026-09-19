import Image from "next/image";
import { BRAND_LOGO } from "@/lib/brand";

export function SiteLogo({
  className = "",
  priority = false,
}: {
  /** @deprecated Both variants use the same brand mark. */
  variant?: "gold" | "dark";
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={BRAND_LOGO.path}
      alt="Aniekanvas Aesthetics"
      width={BRAND_LOGO.width}
      height={BRAND_LOGO.height}
      priority={priority}
      // Media proxy — skip optimizer so /api/media streams reliably.
      unoptimized
      className={`h-10 w-auto max-w-[min(100%,13.5rem)] object-contain object-left sm:h-12 sm:max-w-[15rem] ${className}`}
    />
  );
}
