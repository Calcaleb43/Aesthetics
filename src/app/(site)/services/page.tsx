import { bookingHref } from "@/lib/booking/money";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getPublishedServices, getSettings } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesIndexPage() {
  const [services, settings] = await Promise.all([getPublishedServices(), getSettings()]);
  const heroImage = settings.galleryImages[1] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Treatments"
        title="Signature services"
        subtitle="Personalized aesthetics with precision, intention, and care — from brows and PMU to laser and skin renewal."
        image={heroImage}
        imageAlt="Aniekanvas services"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "Request consult", href: "/contact", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="container">
          <div className="border-t border-[var(--line)]">
            {services.map((service, index) => (
              <ScrollReveal key={service.slug} delay={index * 70}>
                <Link href={`/services/${service.slug}`} className="service-row group">
                  <span className="text-sm tracking-[0.18em] text-[var(--gold-deep)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[0.68rem] tracking-[0.2em] text-[var(--gold-deep)]">{service.shortTitle}</p>
                    <h2 className="display mt-2 text-3xl md:text-4xl">{service.title}</h2>
                    <p className="mt-2 font-medium">{service.tagline}</p>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">{service.summary}</p>
                  </div>
                  <span className="arrow text-xs uppercase tracking-[0.18em]">Explore →</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
