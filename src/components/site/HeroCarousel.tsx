"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

const AUTO_MS = 6500;

export function HeroCarousel({
  slides,
  bookingUrl,
}: {
  slides: HeroSlide[];
  bookingUrl: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const active = slides[index] ?? slides[0];

  const goTo = useEffectEvent((next: number) => {
    setIndex(((next % count) + count) % count);
  });

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = window.setInterval(() => goTo(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [index, paused, count]);

  if (!active) return null;

  return (
    <section
      className="relative min-h-[92vh] overflow-hidden bg-black text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      {slides.map((slide, i) => {
        const isActive = i === index;
        return (
          <div
            key={`${slide.image}-${i}`}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!isActive}
          >
            <Image
              src={slide.image}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={`object-cover object-center transition-transform duration-[7000ms] ease-out ${
                isActive ? "scale-110" : "scale-100"
              }`}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.5)_48%,rgba(0,0,0,0.84)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(198,167,94,0.24),transparent_42%)]" />
          </div>
        );
      })}

      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-5 pb-16 pt-28 lg:px-8 lg:pb-20">
        <div key={index} className="hero-slide-copy max-w-5xl">
          <p className="eyebrow !text-[var(--accent-soft)]">
            <span>{active.eyebrow}</span>
          </p>
          <h1 className="display mt-5 text-[clamp(2.8rem,9vw,6.4rem)] leading-[0.9] text-white">
            {active.title}
          </h1>
          <div className="mt-6 h-px w-48 origin-left bg-[linear-gradient(90deg,var(--gold),transparent)] hero-slide-rule" />
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/80 md:text-xl">{active.subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={active.ctaHref.startsWith("http") ? active.ctaHref : active.ctaHref}
              target={active.ctaHref.startsWith("http") ? "_blank" : undefined}
              rel={active.ctaHref.startsWith("http") ? "noreferrer" : undefined}
              className="btn btn-gold"
            >
              {active.ctaLabel}
            </a>
            {active.secondaryHref && active.secondaryLabel ? (
              active.secondaryHref.startsWith("http") ? (
                <a
                  href={active.secondaryHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
                >
                  {active.secondaryLabel}
                </a>
              ) : (
                <Link
                  href={active.secondaryHref}
                  className="btn border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
                >
                  {active.secondaryLabel}
                </Link>
              )
            ) : (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="btn border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
              >
                Book Now
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between gap-6 border-t border-white/15 pt-6">
          <div className="flex items-center gap-2" role="tablist" aria-label="Slide selectors">
            {slides.map((slide, i) => (
              <button
                key={`dot-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                className="group relative h-10 w-14 overflow-hidden"
                onClick={() => goTo(i)}
              >
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/25 transition group-hover:bg-white/50" />
                {i === index ? (
                  <span
                    key={`progress-${index}`}
                    className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 origin-left bg-[var(--gold)] hero-progress"
                    style={{
                      animationDuration: `${AUTO_MS}ms`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[0.7rem] tracking-[0.22em] text-white/55">
              {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-sm transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
              onClick={() => goTo(index - 1)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-sm transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
              onClick={() => goTo(index + 1)}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
