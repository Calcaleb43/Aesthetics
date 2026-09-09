import Link from "next/link";
import { ParallaxImage } from "@/components/site/ParallaxImage";

type Cta = {
  label: string;
  href: string;
  variant?: "gold" | "ghost";
};

type PageHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  image: string;
  imageAlt?: string;
  size?: "default" | "tall" | "compact";
  ctas?: Cta[];
  align?: "start" | "center";
};

function CtaLink({ cta }: { cta: Cta }) {
  const className =
    cta.variant === "ghost"
      ? "btn border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
      : "btn btn-gold";

  if (cta.href.startsWith("http")) {
    return (
      <a href={cta.href} target="_blank" rel="noreferrer" className={className}>
        {cta.label}
      </a>
    );
  }

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  imageAlt = "",
  size = "default",
  ctas,
  align = "start",
}: PageHeroProps) {
  const height =
    size === "tall"
      ? "min-h-[78vh] min-h-[78dvh]"
      : size === "compact"
        ? "min-h-[46vh] min-h-[46dvh]"
        : "min-h-[58vh] min-h-[58dvh]";

  return (
    <section className={`relative overflow-x-clip bg-black text-white ${height}`}>
      <div className="absolute inset-0 overflow-hidden">
        <ParallaxImage src={image} alt={imageAlt} className="opacity-55" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(198,167,94,0.22),transparent_42%)]" />
      </div>

      <div
        className={`relative z-10 mx-auto flex ${height} max-w-7xl flex-col justify-end px-5 pb-10 pt-24 sm:pb-12 sm:pt-28 lg:px-8 lg:pb-16 ${
          align === "center" ? "items-center text-center" : ""
        }`}
      >
        <div className={`fade-up ${align === "center" ? "max-w-3xl" : "max-w-4xl"}`}>
          <p className="eyebrow !text-[var(--accent-soft)]">
            <span>{eyebrow}</span>
          </p>
          <h1 className="display fade-up-delay-1 mt-4 break-words text-[clamp(2.2rem,8vw,5.6rem)] leading-[0.95] sm:leading-[0.92]">
            {title}
          </h1>
          <div
            className={`reveal-line mt-5 h-px w-32 bg-[linear-gradient(90deg,var(--gold),transparent)] sm:mt-6 sm:w-40 ${
              align === "center" ? "mx-auto" : ""
            }`}
          />
          {subtitle ? (
            <p className="fade-up-delay-2 mt-5 max-w-2xl text-base leading-7 text-white/80 sm:mt-6 sm:text-lg sm:leading-8 md:text-xl">
              {subtitle}
            </p>
          ) : null}
          {ctas && ctas.length > 0 ? (
            <div className="fade-up-delay-3 mt-7 flex flex-wrap gap-3 sm:mt-9">
              {ctas.map((cta) => (
                <CtaLink key={`${cta.href}-${cta.label}`} cta={cta} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
