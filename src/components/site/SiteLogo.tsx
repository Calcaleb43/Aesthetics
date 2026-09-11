import Image from "next/image";

export function SiteLogo({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Aniekanvas Aesthetics"
      width={592}
      height={265}
      priority={priority}
      className={`h-11 w-auto max-w-[min(100%,12rem)] object-contain object-left ${className}`}
    />
  );
}
