import { getPrisma, hasDatabase } from "@/lib/db";
import {
  getSeedCare,
  getSeedCareGuides,
  getSeedFaq,
  getSeedFaqs,
  getSeedPage,
  getSeedPages,
  getSeedService,
  getSeedServices,
  getSeedSettings,
  type CareRecord,
  type FaqRecord,
  type PageRecord,
  type ServiceRecord,
  type SiteSettings,
} from "./seed";

type ValueItem = { title: string; body: string };
type FaqItem = { question: string; answer: string };

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asValueItems(value: unknown): ValueItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ValueItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as ValueItem).title === "string" &&
      typeof (item as ValueItem).body === "string",
  );
}

function asFaqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is FaqItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as FaqItem).question === "string" &&
      typeof (item as FaqItem).answer === "string",
  );
}

export async function getSettings(): Promise<SiteSettings> {
  if (!hasDatabase()) return getSeedSettings();
  try {
    const row = await getPrisma().siteSettings.findUnique({ where: { id: 1 } });
    if (!row) return getSeedSettings();
    return {
      siteName: row.siteName,
      tagline: row.tagline,
      subtitle: row.subtitle,
      email: row.email,
      phone: row.phone,
      address: row.address,
      instagramUrl: row.instagramUrl,
      bookingUrl: row.bookingUrl,
      heroImage: row.heroImage,
      aboutImage: row.aboutImage,
      galleryImages: asStringArray(row.galleryImages),
      homeIntro: row.homeIntro,
      whyHeadline: row.whyHeadline,
      whyBody: row.whyBody,
      values: asValueItems(row.values),
      meetAnie: row.meetAnie,
    };
  } catch {
    return getSeedSettings();
  }
}

export async function getPublishedServices(): Promise<ServiceRecord[]> {
  if (!hasDatabase()) return getSeedServices();
  try {
    const rows = await getPrisma().service.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
    });
    if (!rows.length) return getSeedServices();
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      shortTitle: row.shortTitle,
      tagline: row.tagline,
      summary: row.summary,
      sortOrder: row.sortOrder,
      status: row.status,
      content: row.content,
      coverImage: row.coverImage,
      bookingUrl: row.bookingUrl,
    }));
  } catch {
    return getSeedServices();
  }
}

export async function getService(slug: string): Promise<ServiceRecord | null> {
  if (!hasDatabase()) return getSeedService(slug);
  try {
    const row = await getPrisma().service.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return getSeedService(slug);
    return {
      slug: row.slug,
      title: row.title,
      shortTitle: row.shortTitle,
      tagline: row.tagline,
      summary: row.summary,
      sortOrder: row.sortOrder,
      status: row.status,
      content: row.content,
      coverImage: row.coverImage,
      bookingUrl: row.bookingUrl,
    };
  } catch {
    return getSeedService(slug);
  }
}

export async function getPage(slug: string): Promise<PageRecord | null> {
  if (!hasDatabase()) return getSeedPage(slug);
  try {
    const row = await getPrisma().page.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return getSeedPage(slug);
    return {
      slug: row.slug,
      title: row.title,
      status: row.status,
      excerpt: row.excerpt,
      content: row.content,
      seoTitle: row.seoTitle,
      coverImage: row.coverImage,
    };
  } catch {
    return getSeedPage(slug);
  }
}

export async function getAllPages(): Promise<PageRecord[]> {
  if (!hasDatabase()) return getSeedPages();
  try {
    const rows = await getPrisma().page.findMany();
    if (!rows.length) return getSeedPages();
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      status: row.status,
      excerpt: row.excerpt,
      content: row.content,
      seoTitle: row.seoTitle,
      coverImage: row.coverImage,
    }));
  } catch {
    return getSeedPages();
  }
}

export async function getFaq(serviceSlug: string): Promise<FaqRecord | null> {
  if (!hasDatabase()) return getSeedFaq(serviceSlug);
  try {
    const row = await getPrisma().faq.findUnique({ where: { serviceSlug } });
    if (!row || row.status !== "published") return getSeedFaq(serviceSlug);
    return {
      serviceSlug: row.serviceSlug,
      title: row.title,
      intro: row.intro,
      status: row.status,
      items: asFaqItems(row.items),
    };
  } catch {
    return getSeedFaq(serviceSlug);
  }
}

export async function getAllFaqs(): Promise<FaqRecord[]> {
  if (!hasDatabase()) return getSeedFaqs();
  try {
    const rows = await getPrisma().faq.findMany({ where: { status: "published" } });
    if (!rows.length) return getSeedFaqs();
    return rows.map((row) => ({
      serviceSlug: row.serviceSlug,
      title: row.title,
      intro: row.intro,
      status: row.status,
      items: asFaqItems(row.items),
    }));
  } catch {
    return getSeedFaqs();
  }
}

export async function getCare(serviceSlug: string): Promise<CareRecord | null> {
  if (!hasDatabase()) return getSeedCare(serviceSlug);
  try {
    const row = await getPrisma().careGuide.findUnique({ where: { serviceSlug } });
    if (!row || row.status !== "published") return getSeedCare(serviceSlug);
    return {
      serviceSlug: row.serviceSlug,
      title: row.title,
      status: row.status,
      content: row.content,
      coverImage: row.coverImage,
    };
  } catch {
    return getSeedCare(serviceSlug);
  }
}

export async function getAllCare(): Promise<CareRecord[]> {
  if (!hasDatabase()) return getSeedCareGuides();
  try {
    const rows = await getPrisma().careGuide.findMany({ where: { status: "published" } });
    if (!rows.length) return getSeedCareGuides();
    return rows.map((row) => ({
      serviceSlug: row.serviceSlug,
      title: row.title,
      status: row.status,
      content: row.content,
      coverImage: row.coverImage,
    }));
  } catch {
    return getSeedCareGuides();
  }
}
