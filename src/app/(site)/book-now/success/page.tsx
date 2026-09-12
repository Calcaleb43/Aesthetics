import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Booking confirmed",
  description: "Your appointment booking confirmation.",
  path: "/book-now/success",
  noIndex: true,
});

export default async function BookSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>;
}) {
  const { appointment: id } = await searchParams;
  const settings = await getSettings();
  let summary: { title: string; startsAt: string; email: string } | null = null;

  if (id && hasDatabase()) {
    try {
      const row = await getPrisma().appointment.findUnique({
        where: { id },
        include: {
          service: { select: { title: true } },
          category: { select: { title: true } },
          lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
        },
      });
      if (row && (row.status === "confirmed" || row.status === "pending_payment")) {
        const { appointmentDisplayTitle } = await import("@/lib/booking/labels");
        summary = {
          title: appointmentDisplayTitle(row),
          startsAt: row.startsAt.toISOString(),
          email: row.clientEmail,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Booked"
        title="You're confirmed"
        subtitle="Thank you — your appointment request is in. A payment receipt will come from Stripe when applicable."
        image={settings.heroImage}
        size="compact"
      />
      <section className="section-tight mx-auto max-w-2xl pb-20">
        {summary ? (
          <div className="rounded-2xl border border-black/10 p-6 text-sm leading-7">
            <p>
              <strong>{summary.title}</strong>
            </p>
            <p>
              {new Intl.DateTimeFormat("en-CA", {
                timeZone: settings.timezone || "America/Toronto",
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(summary.startsAt))}
            </p>
            <p className="text-[var(--ink-soft)]">
              Confirmation details sent toward {summary.email} via Stripe receipt when paid.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">
            Your booking was received. Check your email for payment confirmation.
          </p>
        )}
        <Link href="/services" className="btn mt-8">
          Back to services
        </Link>
      </section>
    </>
  );
}
