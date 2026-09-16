import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ManageAppointmentClient } from "@/components/site/ManageAppointmentClient";
import { getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Manage appointment",
  description: "Cancel or reschedule your Aniekanvas appointment.",
  path: "/book-now/manage",
  noIndex: true,
});

export default async function ManageAppointmentPage({
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
        title="Manage appointment"
        subtitle="Cancel or move your visit up to 48 hours before your appointment. The studio is notified by email and SMS when you make a change."
        image={settings.heroImage}
        imageAlt="Aniekanvas Aesthetics"
        size="compact"
      />
      <section className="section-tight mx-auto max-w-2xl pb-20">
        {token ? (
          <ManageAppointmentClient token={token} />
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">
            Open the manage link from your confirmation or reminder email to cancel or reschedule.
          </p>
        )}
      </section>
    </>
  );
}
