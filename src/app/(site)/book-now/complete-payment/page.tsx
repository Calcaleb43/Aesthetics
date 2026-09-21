import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { CompletePaymentClient } from "@/components/site/CompletePaymentClient";
import { getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Complete payment",
  description: "Confirm your Aniekanvas booking time and finish payment.",
  path: "/book-now/complete-payment",
  noIndex: true,
});

export default async function CompletePaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const settings = await getSettings();

  return (
    <>
      <PageHero
        eyebrow="Your booking"
        title="Complete payment"
        subtitle="We confirm your time is still open, then take you to secure checkout. If that slot was taken, you can pick a new date and time for the same services."
        image={settings.heroImage}
        imageAlt="Aniekanvas Aesthetics"
        size="compact"
      />
      <section className="section-tight mx-auto max-w-3xl pb-20">
        {token ? (
          <CompletePaymentClient token={token} />
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">
            Open the complete-payment link from your booking email to finish confirming your visit.
          </p>
        )}
      </section>
    </>
  );
}
