import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { PackageBuyCard } from "@/components/site/PackageBuyCard";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { bookingHref } from "@/lib/booking/money";
import { getSettings } from "@/lib/content/queries";
import { getPrisma, hasDatabase } from "@/lib/db";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildPageMetadata({
    title: "Packages",
    description: `Prepaid treatment packages at ${settings.siteName} — buy sessions ahead and redeem when you book.`,
    path: "/packages",
    image: settings.galleryImages[0] || settings.heroImage,
  });
}

async function getActivePackages() {
  if (!hasDatabase()) return [];
  try {
    return await getPrisma().packageOffer.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  } catch {
    return [];
  }
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ purchased?: string; cancelled?: string }>;
}) {
  const { purchased, cancelled } = await searchParams;
  const [settings, packages] = await Promise.all([getSettings(), getActivePackages()]);
  const heroImage = settings.galleryImages[0] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Prepaid"
        title="Treatment packages"
        subtitle="Purchase a multi-session package, then redeem sessions when you book eligible treatments."
        image={heroImage}
        imageAlt="Aniekanvas packages"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "Contact", href: "/contact", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="container max-w-3xl">
          {purchased ? (
            <p className="mb-8 rounded-2xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Payment received — your package will appear for booking once Stripe confirms. Check your email for the receipt.
            </p>
          ) : null}
          {cancelled ? (
            <p className="mb-8 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-[var(--ink-soft)]">
              Checkout cancelled. You can try again whenever you&apos;re ready.
            </p>
          ) : null}

          {!packages.length ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No packages are available right now. Check back soon or{" "}
              <a href="/contact" className="underline underline-offset-2">
                contact the studio
              </a>
              .
            </p>
          ) : (
            <div className="border-t border-[var(--line)]">
              {packages.map((pkg, index) => (
                <ScrollReveal key={pkg.id} delay={index * 70}>
                  <PackageBuyCard
                    pkg={{
                      id: pkg.id,
                      slug: pkg.slug,
                      title: pkg.title,
                      description: pkg.description,
                      priceCents: pkg.priceCents,
                      sessionCount: pkg.sessionCount,
                    }}
                    hstRateBps={settings.hstRateBps}
                  />
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
