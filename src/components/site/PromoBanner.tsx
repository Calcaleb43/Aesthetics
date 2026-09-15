import Link from "next/link";

export function PromoBanner({
  enabled,
  text,
  href,
}: {
  enabled: boolean;
  text: string;
  href?: string;
}) {
  const label = text.trim();
  if (!enabled || !label) return null;

  const className =
    "block w-full bg-[var(--ink)] px-4 py-2.5 text-center text-[0.68rem] font-medium tracking-[0.14em] uppercase text-white";

  if (href?.trim()) {
    const target = href.trim();
    const external = /^https?:\/\//i.test(target);
    if (external) {
      return (
        <a href={target} target="_blank" rel="noreferrer" className={`${className} transition hover:bg-black`}>
          {label}
        </a>
      );
    }
    return (
      <Link href={target} className={`${className} transition hover:bg-black`}>
        {label}
      </Link>
    );
  }

  return <div className={className}>{label}</div>;
}
