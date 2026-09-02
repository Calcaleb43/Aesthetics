import seed from "./seed-data.json";

export type SiteSettings = typeof seed.siteSettings;

export type PageRecord = {
  slug: string;
  title: string;
  status: string;
  excerpt: string;
  content: string;
  seoTitle: string | null;
  coverImage: string | null;
};

export type ServiceRecord = {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  summary: string;
  sortOrder: number;
  status: string;
  content: string;
  coverImage: string | null;
  bookingUrl: string | null;
};

export type FaqRecord = {
  serviceSlug: string;
  title: string;
  intro: string;
  status: string;
  items: { question: string; answer: string }[];
};

export type CareRecord = {
  serviceSlug: string;
  title: string;
  status: string;
  content: string;
  coverImage: string | null;
};

export const seedData = seed;

export function getSeedSettings(): SiteSettings {
  return seed.siteSettings;
}

export function getSeedPages(): PageRecord[] {
  return seed.pages;
}

export function getSeedPage(slug: string) {
  return seed.pages.find((p) => p.slug === slug) ?? null;
}

export function getSeedServices(): ServiceRecord[] {
  return [...seed.services].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSeedService(slug: string) {
  return seed.services.find((s) => s.slug === slug) ?? null;
}

export function getSeedFaqs(): FaqRecord[] {
  return seed.faqs;
}

export function getSeedFaq(serviceSlug: string) {
  return seed.faqs.find((f) => f.serviceSlug === serviceSlug) ?? null;
}

export function getSeedCareGuides(): CareRecord[] {
  return seed.careGuides;
}

export function getSeedCare(serviceSlug: string) {
  return seed.careGuides.find((c) => c.serviceSlug === serviceSlug) ?? null;
}
