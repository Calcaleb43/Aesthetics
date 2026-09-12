import { bookingHref } from "@/lib/booking/money";
import type { Metadata } from "next";
import { ContactForm } from "@/components/site/ContactForm";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { StudioMap } from "@/components/site/StudioMap";
import { getPublishedServices, getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildPageMetadata({
    title: "Contact",
    description: `Request a consultation with ${settings.siteName}. Email ${settings.email} or call ${settings.phone}.`,
    path: "/contact",
    image: settings.galleryImages[1] || settings.aboutImage || settings.heroImage,
  });
}

export default async function ContactPage() {
  const [settings, services] = await Promise.all([getSettings(), getPublishedServices()]);
  const heroImage = settings.galleryImages[1] || settings.aboutImage || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Contact"
        title="Request a consultation"
        subtitle="Share your goals and questions. We'll follow up to help you choose the right next step."
        image={heroImage}
        imageAlt="Contact Aniekanvas"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "View services", href: "/services", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-2">
          <ScrollReveal variant="left">
            <p className="eyebrow">Studio details</p>
            <h2 className="display mt-4 text-3xl md:text-4xl">Visit or reach out</h2>
            <div className="gold-rule mt-6 max-w-xs" />
            <div className="mt-8 space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
              <p>{settings.address}</p>
              <a href={`mailto:${settings.email}`} className="block transition hover:text-[var(--gold-deep)]">
                {settings.email}
              </a>
              <a href={`tel:${settings.phone}`} className="block transition hover:text-[var(--gold-deep)]">
                {settings.phone}
              </a>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="right" delay={120}>
            <div className="border border-black/10 bg-[var(--bg-deep)] p-6 md:p-8">
              <ContactForm serviceOptions={services.map((s) => s.title)} />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-tight bg-[var(--bg-deep)]">
        <div className="container">
          <ScrollReveal>
            <p className="eyebrow">Find us</p>
            <h2 className="display mt-4 text-3xl md:text-4xl">Studio location</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
              {settings.address}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100} className="mt-8">
            <StudioMap address={settings.address} />
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
