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
  featured?: boolean;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: PaymentMode;
  bookable: boolean;
  id?: string;
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

function mapSeedService(s: (typeof seed.services)[number]): ServiceRecord {
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
    durationMinutes: (s as { durationMinutes?: number }).durationMinutes ?? 60,
    priceCents: (s as { priceCents?: number }).priceCents ?? 0,
    depositCents: (s as { depositCents?: number | null }).depositCents ?? null,
    paymentMode: ((s as { paymentMode?: PaymentMode }).paymentMode || "deposit") as PaymentMode,
    bookable: (s as { bookable?: boolean }).bookable ?? true,
  };
}

export function getSeedServices(): ServiceRecord[] {
  return [...seed.services].map(mapSeedService).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSeedService(slug: string) {
  const found = seed.services.find((s) => s.slug === slug);
  return found ? mapSeedService(found) : null;
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
