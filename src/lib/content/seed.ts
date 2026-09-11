import seed from "./seed-data.json";

export type WeeklyWindow = { start: string; end: string };
export type WeeklyHours = Record<string, WeeklyWindow[]>;
export type PaymentMode = "deposit" | "full" | "none";

export type SiteSettings = {
  siteName: string;
  tagline: string;
  subtitle: string;
  email: string;
  phone: string;
  address: string;
  instagramUrl: string;
  bookingUrl: string;
  heroImage: string;
  aboutImage: string;
  galleryImages: string[];
  homeIntro: string;
  whyHeadline: string;
  whyBody: string;
  values: { title: string; body: string }[];
  meetAnie: string;
  googleReviewsUrl: string;
  googlePlaceId: string;
  timezone: string;
  weeklyHours: WeeklyHours;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  hstRateBps: number;
  bookingEnabled: boolean;
};

export type PageRecord = {
  slug: string;
  title: string;
  status: string;
  excerpt: string;
  content: string;
  seoTitle: string | null;
  coverImage: string | null;
};

export type CategoryRecord = {
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
  featured?: boolean;
  id?: string;
};

export type ServiceRecord = {
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  status: string;
  categorySlug: string;
  categoryId?: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: PaymentMode;
  bookable: boolean;
  id?: string;
};

/** @deprecated Use CategoryRecord — alias for site pages that still say “service” for categories */
export type ServiceCategoryRecord = CategoryRecord;

export type FaqRecord = {
  categorySlug: string;
  title: string;
  intro: string;
  status: string;
  items: { question: string; answer: string }[];
};

export type CareRecord = {
  categorySlug: string;
  title: string;
  status: string;
  content: string;
  coverImage: string | null;
};

export type TestimonialRecord = {
  id: string;
  quote: string;
  authorName: string;
  rating: number;
  source: string;
  sourceUrl: string | null;
  sortOrder: number;
  status: string;
};

export const seedData = seed;

const DEFAULT_WEEKLY: WeeklyHours = {
  mon: [{ start: "10:00", end: "18:00" }],
  tue: [{ start: "10:00", end: "18:00" }],
  wed: [{ start: "10:00", end: "18:00" }],
  thu: [{ start: "10:00", end: "18:00" }],
  fri: [{ start: "10:00", end: "18:00" }],
  sat: [{ start: "10:00", end: "16:00" }],
  sun: [],
};

export function getSeedSettings(): SiteSettings {
  const s = seed.siteSettings;
  return {
    siteName: s.siteName,
    tagline: s.tagline,
    subtitle: s.subtitle,
    email: s.email,
    phone: s.phone,
    address: s.address,
    instagramUrl: s.instagramUrl,
    bookingUrl: s.bookingUrl,
    heroImage: s.heroImage,
    aboutImage: s.aboutImage,
    galleryImages: s.galleryImages,
    homeIntro: s.homeIntro,
    whyHeadline: s.whyHeadline,
    whyBody: s.whyBody,
    values: s.values,
    meetAnie: s.meetAnie,
    googleReviewsUrl: (s as { googleReviewsUrl?: string }).googleReviewsUrl || "",
    googlePlaceId: (s as { googlePlaceId?: string }).googlePlaceId || "",
    timezone: (s as { timezone?: string }).timezone || "America/Toronto",
    weeklyHours: ((s as { weeklyHours?: WeeklyHours }).weeklyHours as WeeklyHours) || DEFAULT_WEEKLY,
    slotIntervalMinutes: (s as { slotIntervalMinutes?: number }).slotIntervalMinutes ?? 30,
    bufferMinutes: (s as { bufferMinutes?: number }).bufferMinutes ?? 15,
    minLeadHours: (s as { minLeadHours?: number }).minLeadHours ?? 24,
    maxAdvanceDays: (s as { maxAdvanceDays?: number }).maxAdvanceDays ?? 60,
    hstRateBps: (s as { hstRateBps?: number }).hstRateBps ?? 1300,
    bookingEnabled: (s as { bookingEnabled?: boolean }).bookingEnabled ?? true,
  };
}

export function getSeedPages(): PageRecord[] {
  return seed.pages;
}

export function getSeedPage(slug: string) {
  return seed.pages.find((p) => p.slug === slug) ?? null;
}

function mapSeedCategory(s: (typeof seed.categories)[number]): CategoryRecord {
  return {
    slug: s.slug,
    title: s.title,
    shortTitle: s.shortTitle,
    tagline: s.tagline,
    summary: s.summary,
    sortOrder: s.sortOrder,
    status: s.status,
    content: s.content,
    coverImage: s.coverImage,
    bookingUrl: s.bookingUrl,
    featured: (s as { featured?: boolean }).featured ?? true,
  };
}

export function getSeedCategories(): CategoryRecord[] {
  return [...seed.categories].map(mapSeedCategory).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSeedCategory(slug: string) {
  const found = seed.categories.find((s) => s.slug === slug);
  return found ? mapSeedCategory(found) : null;
}

/** @deprecated alias — public site still calls these “services” meaning categories */
export function getSeedServices(): CategoryRecord[] {
  return getSeedCategories();
}

export function getSeedService(slug: string) {
  return getSeedCategory(slug);
}

function mapSeedBookableService(s: (typeof seed.services)[number]): ServiceRecord {
  return {
    slug: s.slug,
    title: s.title,
    summary: s.summary || "",
    sortOrder: s.sortOrder,
    status: s.status,
    categorySlug: s.categorySlug,
    durationMinutes: s.durationMinutes ?? 60,
    priceCents: s.priceCents ?? 0,
    depositCents: s.depositCents ?? null,
    paymentMode: ((s.paymentMode || "deposit") as PaymentMode),
    bookable: s.bookable ?? true,
  };
}

export function getSeedBookableServices(): ServiceRecord[] {
  return [...seed.services].map(mapSeedBookableService).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSeedBookableService(slug: string) {
  const found = seed.services.find((s) => s.slug === slug);
  return found ? mapSeedBookableService(found) : null;
}

export function getSeedFaqs(): FaqRecord[] {
  return seed.faqs.map((f) => ({
    categorySlug: (f as { categorySlug?: string; serviceSlug?: string }).categorySlug
      || (f as { serviceSlug?: string }).serviceSlug
      || "",
    title: f.title,
    intro: f.intro,
    status: f.status,
    items: f.items,
  }));
}

export function getSeedFaq(categorySlug: string) {
  return getSeedFaqs().find((f) => f.categorySlug === categorySlug) ?? null;
}

export function getSeedCareGuides(): CareRecord[] {
  return seed.careGuides.map((c) => ({
    categorySlug: (c as { categorySlug?: string; serviceSlug?: string }).categorySlug
      || (c as { serviceSlug?: string }).serviceSlug
      || "",
    title: c.title,
    status: c.status,
    content: c.content,
    coverImage: c.coverImage,
  }));
}

export function getSeedCare(categorySlug: string) {
  return getSeedCareGuides().find((c) => c.categorySlug === categorySlug) ?? null;
}
