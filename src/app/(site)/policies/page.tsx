import { bookingHref } from "@/lib/booking/money";
import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { getPage, getSettings } from "@/lib/content/queries";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("policies");
  return { title: page?.seoTitle || page?.title || "Policies" };
}

export default async function PoliciesPage() {
  const [page, settings] = await Promise.all([getPage("policies"), getSettings()]);
  const heroImage = settings.galleryImages[5] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Studio standards"
        title={page?.title || "Policies"}
        subtitle="Clear expectations that protect your experience, your results, and our shared time together."
        image={heroImage}
        imageAlt="Policies"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "Contact", href: "/contact", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="mx-auto max-w-3xl">
          <ContentBlocks content={page?.content || ""} />
        </div>
      </section>
    </div>
  );
}
