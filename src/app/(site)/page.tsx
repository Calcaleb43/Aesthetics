import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { HeroCarousel, type HeroSlide } from "@/components/site/HeroCarousel";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { TestimonialsSection } from "@/components/site/TestimonialsSection";
import { bookingHref } from "@/lib/booking/money";
import { getFeaturedServices, getPublishedTestimonials, getSettings } from "@/lib/content/queries";
import { getGooglePlaceReviews, hasGooglePlacesConfig } from "@/lib/google/places-reviews";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildPageMetadata({
    title: settings.siteName || "ANIEKANVAS AESTHETICS",
    description: settings.subtitle || settings.tagline,
    path: "/",
    image: settings.heroImage,
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const [settings, services, curated] = await Promise.all([
    getSettings(),
    getFeaturedServices(),
    getPublishedTestimonials(),
  ]);
  const google = hasGooglePlacesConfig(settings.googlePlaceId)
    ? await getGooglePlaceReviews(settings.googlePlaceId)
    : null;
  const bookNow = bookingHref(settings.bookingEnabled, settings.bookingUrl);

  const images = [
    settings.heroImage,
    ...settings.galleryImages.filter((src) => src !== settings.heroImage),
  ];

  const heroSlides: HeroSlide[] = [
    {
      image: images[0] || settings.heroImage,
      eyebrow: "Toronto · Beauty with intention",
      title: settings.siteName,
      subtitle: settings.tagline,
      ctaLabel: "Book Now",
      ctaHref: bookNow,
      secondaryLabel: "Meet Anie",
      secondaryHref: "/about",
    },
    ...services.slice(0, 4).map((service, index) => ({
      image: service.coverImage || images[(index + 1) % Math.max(images.length, 1)] || settings.heroImage,
      eyebrow: service.shortTitle,
      title: service.title,
      subtitle: service.tagline || service.summary,
      ctaLabel: "Explore",
      ctaHref: `/services/${service.slug}`,
      secondaryLabel: "Book Now",
      secondaryHref: bookingHref(settings.bookingEnabled, settings.bookingUrl, service.slug),
    })),
  ];

  return (
    <div>
      <HeroCarousel slides={heroSlides} bookingUrl={bookNow} />

      <section className="section">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <ScrollReveal variant="left">
              <p className="eyebrow">The studio</p>
              <h2 className="display mt-4 text-4xl md:text-5xl lg:text-6xl">{settings.whyHeadline}</h2>
            </ScrollReveal>
            <ScrollReveal variant="right" delay={120}>
              <p className="max-w-2xl text-lg leading-8 text-[var(--ink-soft)] md:text-xl">{settings.homeIntro}</p>
              {settings.whyBody ? (
                <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--ink-soft)]">{settings.whyBody}</p>
              ) : null}
            </ScrollReveal>
          </div>

          <ScrollReveal className="mt-12">
            <div className="gold-rule max-w-md" />
          </ScrollReveal>

          <div className="value-grid mt-10">
            {settings.values.map((value, index) => (
              <ScrollReveal key={value.title} delay={index * 100} variant="up" className="value-item">
                <p className="text-[0.68rem] tracking-[0.22em] text-[var(--gold-deep)]">
                  0{index + 1}
                </p>
                <p className="mt-3 text-sm font-semibold tracking-[0.18em]">{value.title}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{value.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-black text-white">
        <div className="container grid items-center gap-12 lg:grid-cols-2">
          <ScrollReveal variant="scale">
            <div className="media-frame aspect-[4/5] drift">
              <Image
                src={settings.aboutImage}
                alt="Stephanie Anie"
                width={1000}
                height={1250}
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal variant="right" delay={140}>
            <div>
              <p className="eyebrow !text-[var(--accent-soft)]">Founder</p>
              <h2 className="display mt-4 text-4xl md:text-5xl">
                Meet <span className="gold-text">Anie</span>
              </h2>
              <div className="mt-7 max-w-xl space-y-4 text-base leading-8 text-white/75 whitespace-pre-line md:text-lg">
                {settings.meetAnie}
              </div>
              <Link
                href="/about"
                className="btn mt-10 border-white/35 text-white hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black"
              >
                Read her story
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ScrollReveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Signature menu</p>
                <h2 className="display mt-4 text-4xl md:text-5xl lg:text-6xl">Our services</h2>
              </div>
              <Link href="/services" className="btn">
                View all
              </Link>
            </div>
          </ScrollReveal>

          <div className="mt-12 border-t border-[var(--line)]">
            {services.map((service, index) => (
              <ScrollReveal key={service.slug} delay={index * 70}>
                <Link href={`/services/${service.slug}`} className="service-row group">
                  <span className="text-sm tracking-[0.18em] text-[var(--gold-deep)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="display text-2xl md:text-3xl">{service.title}</h3>
                    <p className="mt-2 text-sm text-[var(--ink-soft)] md:text-base">{service.tagline}</p>
                  </div>
                  <span className="arrow text-xs uppercase tracking-[0.18em]">Explore →</span>
                </Link>
              </ScrollReveal>
            ))}
            {!services.length ? (
              <p className="py-10 text-sm text-[var(--ink-soft)]">Featured services will appear here once published.</p>
            ) : null}
          </div>
        </div>
      </section>

      <TestimonialsSection
        google={google}
        curated={curated}
        googleReviewsUrl={settings.googleReviewsUrl}
      />

      <section className="section-tight overflow-hidden bg-[var(--bg-deep)]">
        <div className="container">
          <ScrollReveal>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Atmosphere</p>
                <h2 className="display mt-3 text-3xl md:text-4xl">Studio moments</h2>
              </div>
            </div>
          </ScrollReveal>
        </div>
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-2 md:grid-cols-3 md:gap-3 md:px-5 lg:px-8">
          {settings.galleryImages.map((src, i) => (
            <ScrollReveal key={src} delay={(i % 3) * 90} variant="scale">
              <div className={`media-frame ${i === 0 || i === 3 ? "aspect-[3/4]" : "aspect-square"}`}>
                <Image
                  src={src}
                  alt={`Aniekanvas gallery ${i + 1}`}
                  width={800}
                  height={1000}
                  className="h-full w-full object-cover"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ScrollReveal variant="up">
            <div className="relative overflow-hidden border border-black/10 bg-black px-5 py-12 text-white sm:px-8 sm:py-14 md:px-14 md:py-16">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(198,167,94,0.35),transparent_70%)]" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
                <div>
                  <p className="eyebrow !text-[var(--accent-soft)]">Begin here</p>
                  <h2 className="display mt-4 text-3xl md:text-5xl">Ready for your next era of skin?</h2>
                  <p className="mt-4 max-w-xl text-white/70">
                    Honest consultations. Customized treatments. Results that still look like you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {bookNow.startsWith("http") ? (
                    <a href={bookNow} target="_blank" rel="noreferrer" className="btn btn-gold">
                      Book consultation
                    </a>
                  ) : (
                    <Link href={bookNow} className="btn btn-gold">
                      Book consultation
                    </Link>
                  )}
                  <Link
                    href="/contact"
                    className="btn border-white/35 text-white hover:border-white hover:bg-white hover:text-black"
                  >
                    Contact
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
