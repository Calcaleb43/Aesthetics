import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getAllFaqs, getFaq, getSettings } from "@/lib/content/queries";
import { buildPageMetadata, faqPageJsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  const faqs = await getAllFaqs();
  return faqs.map((f) => ({ slug: f.categorySlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [faq, settings] = await Promise.all([getFaq(slug), getSettings()]);
  return buildPageMetadata({
    title: faq?.title || "FAQ",
    description: faq?.intro || `Frequently asked questions about this treatment at ${settings.siteName}.`,
    path: `/faqs/${slug}`,
    image: settings.galleryImages[3] || settings.heroImage,
  });
}

export default async function FaqDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [faq, settings] = await Promise.all([getFaq(slug), getSettings()]);
  if (!faq) notFound();

  const heroImage = settings.galleryImages[3] || settings.heroImage;

  return (
    <div>
      <JsonLd data={faqPageJsonLd(faq.items)} />
      <PageHero
        eyebrow="FAQ"
        title={faq.title}
        subtitle={faq.intro}
        image={heroImage}
        imageAlt={faq.title}
        size="compact"
        ctas={[
          { label: "View service", href: `/services/${faq.categorySlug}` },
          { label: "Pre & Aftercare", href: `/care/${faq.categorySlug}`, variant: "ghost" },
        ]}
      />

      <section className="section">
        <ScrollReveal className="mx-auto max-w-3xl">
          <Link href="/faqs" className="eyebrow hover:opacity-70">
            ← All FAQs
          </Link>
          <div className="mt-8">
            <FaqAccordion items={faq.items} />
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
