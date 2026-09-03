import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { bookingHref } from "@/lib/booking/money";
import { getPublishedServices, getService, getSettings } from "@/lib/content/queries";

export async function generateStaticParams() {
  const services = await getPublishedServices();
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getService(slug);
  return { title: service?.title || "Service" };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [service, settings] = await Promise.all([getService(slug), getSettings()]);
  if (!service) notFound();

  const heroImage = service.coverImage || settings.heroImage;
  const book = bookingHref(settings.bookingEnabled, settings.bookingUrl, service.slug);

  return (
    <div>
      <PageHero
        eyebrow="Service"
        title={service.title}
        subtitle={service.tagline}
        image={heroImage}
        imageAlt={service.title}
        size="tall"
        ctas={[
          { label: "Book Now", href: book },
          { label: "FAQs", href: `/faqs/${service.slug}`, variant: "ghost" },
          { label: "Pre & Aftercare", href: `/care/${service.slug}`, variant: "ghost" },
        ]}
      />

      <section className="section">
        <ScrollReveal className="mx-auto max-w-3xl">
          <p className="mb-10 text-lg leading-8 text-[var(--ink-soft)]">{service.summary}</p>
          <ContentBlocks content={service.content} />
          <div className="mt-10 flex flex-wrap gap-3">
            {book.startsWith("http") ? (
              <a href={book} target="_blank" rel="noreferrer" className="btn btn-gold">
                Book Now
              </a>
            ) : (
              <Link href={book} className="btn btn-gold">
                Book Now
              </Link>
            )}
            <Link href={`/faqs/${service.slug}`} className="btn">
              FAQs
            </Link>
            <Link href={`/care/${service.slug}`} className="btn">
              Pre & Aftercare
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
