import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { getPage, getSettings } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Policies" };

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
          { label: "Book Now", href: settings.bookingUrl },
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
