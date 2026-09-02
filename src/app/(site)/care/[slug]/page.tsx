import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getAllCare, getCare, getSettings } from "@/lib/content/queries";

export async function generateStaticParams() {
  const guides = await getAllCare();
  return guides.map((g) => ({ slug: g.serviceSlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getCare(slug);
  return { title: guide?.title || "Care guide" };
}

export default async function CareDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, settings] = await Promise.all([getCare(slug), getSettings()]);
  if (!guide) notFound();

  const heroImage = guide.coverImage || settings.galleryImages[0] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Care guide"
        title={guide.title}
        subtitle="Follow these steps before and after your appointment for the best possible healing experience."
        image={heroImage}
        imageAlt={guide.title}
        size="compact"
        ctas={[
          { label: "View service", href: `/services/${guide.serviceSlug}` },
          { label: "FAQs", href: `/faqs/${guide.serviceSlug}`, variant: "ghost" },
        ]}
      />

      <section className="section">
        <ScrollReveal className="mx-auto max-w-3xl">
          <Link href="/care" className="eyebrow hover:opacity-70">
            ← All care guides
          </Link>
          <div className="mt-8">
            <ContentBlocks content={guide.content} />
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/services/${guide.serviceSlug}`} className="btn">
              View service
            </Link>
            <Link href={`/faqs/${guide.serviceSlug}`} className="btn">
              FAQs
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
