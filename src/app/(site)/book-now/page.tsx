import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getPage, getSettings } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Book Now" };

export default async function BookNowPage() {
  const [settings, page] = await Promise.all([getSettings(), getPage("book-now")]);
  const heroImage = settings.galleryImages[0] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Appointments"
        title="Book Now"
        subtitle="Review policies and care guides before booking, then schedule through our booking portal."
        image={heroImage}
        imageAlt="Book an appointment"
        size="tall"
        ctas={[
          { label: "Open booking", href: settings.bookingUrl },
          { label: "Read policies", href: "/policies", variant: "ghost" },
        ]}
      />

      <section className="section">
        <ScrollReveal className="mx-auto max-w-3xl">
          <ContentBlocks content={page?.content || ""} />
          <a href={settings.bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold mt-10">
            Open booking
          </a>
        </ScrollReveal>
      </section>
    </div>
  );
}
