import Link from "next/link";
import { notFound } from "next/navigation";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getAllFaqs, getFaq, getSettings } from "@/lib/content/queries";

export async function generateStaticParams() {
  const faqs = await getAllFaqs();
  return faqs.map((f) => ({ slug: f.categorySlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const faq = await getFaq(slug);
  return { title: faq?.title || "FAQ" };
}

export default async function FaqDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [faq, settings] = await Promise.all([getFaq(slug), getSettings()]);
  if (!faq) notFound();

  const heroImage = settings.galleryImages[3] || settings.heroImage;

  return (
    <div>
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
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/services/${faq.categorySlug}`} className="btn">
              View service
            </Link>
            <Link href={`/care/${faq.categorySlug}`} className="btn">
              Pre & Aftercare
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
