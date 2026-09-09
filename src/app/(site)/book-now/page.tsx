import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { BookingWizard } from "@/components/site/BookingWizard";
import { getPage, getSettings } from "@/lib/content/queries";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("book-now");
  return {
    title: page?.seoTitle || "Book Now",
    description: page?.excerpt || "Book an appointment at Aniekanvas Aesthetics.",
  };
}

export default async function BookNowPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  const [page, settings] = await Promise.all([getPage("book-now"), getSettings()]);

  return (
    <>
      <PageHero
        eyebrow="Book Now"
        title={page?.title || "Book an appointment"}
        subtitle="Choose a service, pick an available time, and secure your visit with a booking payment."
        image={settings.heroImage}
        imageAlt="Aniekanvas Aesthetics studio"
        size="compact"
      />
      <section className="section-tight mx-auto max-w-4xl pb-20">
        <p className="mb-2 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
          Please review pre-care and{" "}
          <a href="/policies" className="underline">
            policies
          </a>{" "}
          before booking.
        </p>
        <BookingWizard initialSlug={service} timezone={settings.timezone} />
        {!settings.bookingEnabled && settings.bookingUrl ? (
          <p className="mt-8 text-sm">
            Prefer the previous scheduler?{" "}
            <a href={settings.bookingUrl} target="_blank" rel="noreferrer" className="underline">
              Open external booking
            </a>
          </p>
        ) : null}
      </section>
    </>
  );
}
