import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { bookingHref, formatCad } from "@/lib/booking/money";
import {
  getPublishedBookableServices,
  getPublishedServices,
  getService,
  getSettings,
} from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const services = await getPublishedServices();
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [service, settings] = await Promise.all([getService(slug), getSettings()]);
  return buildPageMetadata({
    title: service?.title || "Service",
    description: service?.summary || service?.tagline || settings.tagline,
    path: `/services/${slug}`,
    image: service?.coverImage || settings.heroImage,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [service, settings, bookable] = await Promise.all([
    getService(slug),
    getSettings(),
    getPublishedBookableServices(slug),
  ]);
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
          {bookable.length ? (
            <div className="mb-10 border-y border-[var(--line)] py-8">
              <p className="eyebrow">Available services</p>
              <ul className="mt-4 space-y-4">
                {bookable.map((item) => {
                  const variants = item.variants || [];
                  if (variants.length) {
                    const from = Math.min(...variants.map((v) => v.priceCents));
                    return (
                      <li key={item.slug} className="text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-[var(--ink-soft)]">from {formatCad(from)}</span>
                        </div>
                        <ul className="mt-2 space-y-1 border-l border-[var(--line)] pl-3">
                          {variants.map((v) => (
                            <li key={v.slug} className="flex flex-wrap items-baseline justify-between gap-2 text-[var(--ink-soft)]">
                              <span>{v.title}</span>
                              <span>
                                {v.durationMinutes} min · {formatCad(v.priceCents)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  }
                  return (
                    <li key={item.slug} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-[var(--ink-soft)]">
                        {item.durationMinutes} min · {formatCad(item.priceCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
