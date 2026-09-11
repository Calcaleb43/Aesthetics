import Image from "next/image";

const LOGOS = {
  gold: "/brand/logo.png",
  dark: "/brand/logo-dark.png",
} as const;

export function SiteLogo({
  variant = "gold",
  className = "",
  priority = false,
}: {
  variant?: "gold" | "dark";
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGOS[variant]}
      alt="Aniekanvas Aesthetics"
      width={440}
      height={202}
      priority={priority}
      className={`h-11 w-auto max-w-[min(100%,12rem)] object-contain object-left ${className}`}
    />
  );
}
