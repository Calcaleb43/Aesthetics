import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ContentBlocks } from "@/components/site/ContentBlocks";
import { PageHero } from "@/components/site/PageHero";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { getPage, getSettings } from "@/lib/content/queries";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const [settings, page] = await Promise.all([getSettings(), getPage("about")]);

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
          { label: "Book an appointment", href: settings.bookingUrl },
          { label: "Explore services", href: "/services", variant: "ghost" },
        ]}
      />

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <ScrollReveal variant="left">
            <div className="media-frame aspect-[4/5]">
              <Image
                src={settings.aboutImage}
                alt="Stephanie Anie"
                width={1000}
                height={1300}
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal variant="right" delay={120}>
            <ContentBlocks content={page?.content || settings.meetAnie} />
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/services" className="btn">
                Explore services
              </Link>
              <a href={settings.bookingUrl} target="_blank" rel="noreferrer" className="btn btn-gold">
                Book an appointment
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
