import { bookingHref } from "@/lib/booking/money";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getAllFaqs, getPublishedServices, getSettings } from "@/lib/content/queries";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsIndexPage() {
  const [faqs, services, settings] = await Promise.all([
    getAllFaqs(),
    getPublishedServices(),
    getSettings(),
  ]);
  const titleBySlug = Object.fromEntries(services.map((s) => [s.slug, s.title]));
  const heroImage = settings.galleryImages[2] || settings.heroImage;

  return (
    <div>
      <PageHero
        eyebrow="Support"
        title="Frequently asked questions"
        subtitle="Clear answers before you book — organized by service so you can decide with confidence."
        image={heroImage}
        imageAlt="FAQs"
        ctas={[
          { label: "Book Now", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
          { label: "View services", href: "/services", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="mx-auto max-w-4xl">
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {faqs.map((faq, index) => (
              <ScrollReveal key={faq.categorySlug} delay={index * 70}>
                <Link
                  href={`/faqs/${faq.categorySlug}`}
                  className="flex items-center justify-between gap-4 py-6 transition hover:pl-2"
                >
                  <div>
                    <p className="display text-2xl md:text-3xl">{faq.title}</p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      {titleBySlug[faq.categorySlug] || faq.categorySlug} · {faq.items.length} questions
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--gold-deep)]">View →</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
