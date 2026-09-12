import { bookingHref } from "@/lib/booking/money";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getAllCare, getPublishedServices, getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildPageMetadata({
    title: "Pre-Care & Aftercare",
    description: `Pre-care and aftercare guides for treatments at ${settings.siteName}.`,
    path: "/care",
    image: settings.galleryImages[0] || settings.heroImage,
  });
}

export default async function CareIndexPage() {
  const [guides, services, settings] = await Promise.all([
    getAllCare(),
    getPublishedServices(),
    getSettings(),
  ]);
  const titleBySlug = Object.fromEntries(services.map((s) => [s.slug, s.title]));
  const heroImage = settings.galleryImages[4] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Care guides"
        title="Precare & Aftercare"
        subtitle="Preparation and healing guidance for every treatment — so your results heal beautifully."
        image={heroImage}
        imageAlt="Precare and aftercare"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "Read policies", href: "/policies", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="mx-auto max-w-4xl">
          <div className="border-t border-[var(--line)]">
            {guides.map((guide, index) => (
              <ScrollReveal key={guide.categorySlug} delay={index * 70}>
                <Link href={`/care/${guide.categorySlug}`} className="service-row group">
                  <span className="text-sm tracking-[0.18em] text-[var(--gold-deep)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[0.68rem] tracking-[0.18em] text-[var(--gold-deep)]">
                      {titleBySlug[guide.categorySlug] || guide.categorySlug}
                    </p>
                    <h2 className="display mt-2 text-2xl md:text-3xl">{guide.title}</h2>
                  </div>
                  <span className="arrow text-xs uppercase tracking-[0.18em]">Read →</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
