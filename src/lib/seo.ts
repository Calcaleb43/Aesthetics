import type { Metadata } from "next";
import { siteUrl } from "@/lib/booking/stripe";
import type { SiteSettings } from "@/lib/content/seed";

export function absoluteUrl(path = "/") {
  const base = siteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function defaultOgImage(settings?: Pick<SiteSettings, "heroImage"> | null) {
  const src = settings?.heroImage || "/icon.png";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return absoluteUrl(src);
}

export function truncateMeta(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

type BuildPageMetaInput = {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  noIndex?: boolean;
  /** Use absolute title (skip site template), e.g. homepage */
  absoluteTitle?: boolean;
};

export function buildPageMetadata(input: BuildPageMetaInput): Metadata {
  const description = input.description
    ? truncateMeta(input.description)
    : "Brows, PMU, laser hair removal, ink-less scar and stretch mark revision, and cold plasma in Toronto.";
  const url = absoluteUrl(input.path);
  const image = input.image
    ? input.image.startsWith("http")
      ? input.image
      : absoluteUrl(input.image)
    : absoluteUrl("/icon.png");

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_CA",
      url,
      siteName: "ANIEKANVAS AESTHETICS",
      title: input.title,
      description,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [image],
    },
    ...(input.noIndex
      ? { robots: { index: false, follow: false } }
      : { robots: { index: true, follow: true } }),
  };
}

export function localBusinessJsonLd(settings: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: settings.siteName,
    description: truncateMeta(settings.tagline || settings.subtitle, 300),
    url: absoluteUrl("/"),
    image: defaultOgImage(settings),
    email: settings.email,
    telephone: settings.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: "Toronto",
      addressCountry: "CA",
    },
    sameAs: settings.instagramUrl ? [settings.instagramUrl] : undefined,
  };
}

export function faqPageJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
