import { bookingHref } from "@/lib/booking/money";
import Link from "next/link";
import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { MeetAnieVideo } from "@/components/site/MeetAnieVideo";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { htmlToPlainText } from "@/lib/content/html";
import { getPage, getSettings } from "@/lib/content/queries";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPage("about"), getSettings()]);
  return buildPageMetadata({
    title: page?.seoTitle || page?.title || "About",
    description: page?.excerpt || htmlToPlainText(settings.meetAnie) || settings.tagline,
    path: "/about",
    image: settings.aboutImage || settings.heroImage,
  });
}

export default async function AboutPage() {
  const [settings, page] = await Promise.all([getSettings(), getPage("about")]);
  const body = page?.content?.trim() || settings.meetAnie;

  return (
    <div>
      <PageHero
        eyebrow="About"
        title="Beauty with intention."
        subtitle="Where artistry, expertise and personalized care come together."
        image={settings.aboutImage}
        imageAlt="Anie"
        size="tall"
        ctas={[
          { label: "Book an appointment", href: bookingHref(settings.bookingEnabled, settings.bookingUrl) },
        ]}
      />

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <ScrollReveal variant="left">
            <MeetAnieVideo poster={settings.aboutImage} />
          </ScrollReveal>
          <div>
            <ScrollReveal variant="right" delay={80}>
              <ContentBlocks content={body} />
            </ScrollReveal>
            <ScrollReveal delay={160} className="mt-10 flex flex-wrap gap-3">
              <Link href={bookingHref(settings.bookingEnabled, settings.bookingUrl)} className="btn btn-gold">
                Book an appointment
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}
