import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

export default async function BookCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>;
}) {
  const { appointment: id } = await searchParams;
  const settings = await getSettings();

  if (id && hasDatabase()) {
    try {
      await getPrisma().appointment.updateMany({
        where: { id, status: "pending_payment" },
        data: { status: "cancelled" },
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Booking"
        title="Checkout cancelled"
        subtitle="No payment was taken. Your time hold was released — you can pick a new slot whenever you're ready."
        image={settings.heroImage}
        size="compact"
      />
      <section className="section-tight mx-auto max-w-2xl pb-20">
        <Link href="/book-now" className="btn btn-gold">
          Return to booking
        </Link>
      </section>
    </>
  );
}
