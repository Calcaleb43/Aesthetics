import { getPrisma, hasDatabase } from "@/lib/db";
import { asWeeklyHours } from "@/lib/booking/money";
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
  type PaymentMode,
  type PageRecord,
  type ServiceRecord,
  type SiteSettings,
  type TestimonialRecord,
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

function mapPage(row: {
  slug: string;
  title: string;
  status: string;
  excerpt: string;
  content: string;
  seoTitle: string | null;
  coverImage: string | null;
}): PageRecord {
  return {
    slug: row.slug,
    title: row.title,
    status: row.status,
    excerpt: row.excerpt,
    content: row.content,
    seoTitle: row.seoTitle,
    coverImage: row.coverImage,
  };
}

function mapService(row: {
  id?: string;
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
  durationMinutes?: number;
  priceCents?: number;
  depositCents?: number | null;
  paymentMode?: string;
  bookable?: boolean;
}): ServiceRecord {
  return {
    id: row.id,
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
    featured: row.featured ?? true,
    durationMinutes: row.durationMinutes ?? 60,
    priceCents: row.priceCents ?? 0,
    depositCents: row.depositCents ?? null,
    paymentMode: (row.paymentMode as PaymentMode) || "deposit",
    bookable: row.bookable ?? true,
  };
}

function mapFaq(row: {
  serviceSlug: string;
  title: string;
  intro: string;
  status: string;
  items: unknown;
}): FaqRecord {
  return {
    serviceSlug: row.serviceSlug,
    title: row.title,
    intro: row.intro,
    status: row.status,
    items: asFaqItems(row.items),
  };
}

function mapCare(row: {
  serviceSlug: string;
  title: string;
  status: string;
  content: string;
  coverImage: string | null;
}): CareRecord {
  return {
    serviceSlug: row.serviceSlug,
    title: row.title,
    status: row.status,
    content: row.content,
    coverImage: row.coverImage,
  };
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
      googleReviewsUrl: row.googleReviewsUrl || "",
      googlePlaceId: row.googlePlaceId || "",
      timezone: row.timezone || "America/Toronto",
      weeklyHours: asWeeklyHours(row.weeklyHours),
      slotIntervalMinutes: row.slotIntervalMinutes ?? 30,
      bufferMinutes: row.bufferMinutes ?? 15,
      minLeadHours: row.minLeadHours ?? 24,
      maxAdvanceDays: row.maxAdvanceDays ?? 60,
      hstRateBps: row.hstRateBps ?? 1300,
      bookingEnabled: row.bookingEnabled ?? true,
    };
  } catch {
    return getSeedSettings();
  }
}

export async function getPublishedServices(): Promise<ServiceRecord[]> {
  if (!hasDatabase()) return getSeedServices().filter((s) => s.status === "published");
  try {
    const rows = await getPrisma().service.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapService);
  } catch {
    return getSeedServices().filter((s) => s.status === "published");
  }
}

export async function getFeaturedServices(): Promise<ServiceRecord[]> {
  const published = await getPublishedServices();
  const featured = published.filter((s) => s.featured !== false);
  return featured.length ? featured : published;
}

export async function getAdminServices(): Promise<ServiceRecord[]> {
  if (!hasDatabase()) return getSeedServices();
  try {
    const rows = await getPrisma().service.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map(mapService);
  } catch {
    return getSeedServices();
  }
}

export async function getService(slug: string): Promise<ServiceRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedService(slug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().service.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return null;
    return mapService(row);
  } catch {
    const seed = getSeedService(slug);
    return seed?.status === "published" ? seed : null;
  }
}

export async function getPage(slug: string): Promise<PageRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedPage(slug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().page.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return null;
    return mapPage(row);
  } catch {
    const seed = getSeedPage(slug);
    return seed?.status === "published" ? seed : null;
  }
}

export async function getAllPages(): Promise<PageRecord[]> {
  if (!hasDatabase()) return getSeedPages();
  try {
    const rows = await getPrisma().page.findMany({ orderBy: { title: "asc" } });
    return rows.map(mapPage);
  } catch {
    return getSeedPages();
  }
}

export async function getFaq(serviceSlug: string): Promise<FaqRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedFaq(serviceSlug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().faq.findUnique({ where: { serviceSlug } });
    if (!row || row.status !== "published") return null;
    return mapFaq(row);
  } catch {
    const seed = getSeedFaq(serviceSlug);
    return seed?.status === "published" ? seed : null;
  }
}

export async function getAllFaqs(): Promise<FaqRecord[]> {
  if (!hasDatabase()) return getSeedFaqs().filter((f) => f.status === "published");
  try {
    const rows = await getPrisma().faq.findMany({
      where: { status: "published" },
      orderBy: { title: "asc" },
    });
    return rows.map(mapFaq);
  } catch {
    return getSeedFaqs().filter((f) => f.status === "published");
  }
}

export async function getAdminFaqs(): Promise<FaqRecord[]> {
  if (!hasDatabase()) return getSeedFaqs();
  try {
    const rows = await getPrisma().faq.findMany({ orderBy: { title: "asc" } });
    return rows.map(mapFaq);
  } catch {
    return getSeedFaqs();
  }
}

export async function getCare(serviceSlug: string): Promise<CareRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedCare(serviceSlug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().careGuide.findUnique({ where: { serviceSlug } });
    if (!row || row.status !== "published") return null;
    return mapCare(row);
  } catch {
    const seed = getSeedCare(serviceSlug);
    return seed?.status === "published" ? seed : null;
  }
}

export async function getAllCare(): Promise<CareRecord[]> {
  if (!hasDatabase()) return getSeedCareGuides().filter((c) => c.status === "published");
  try {
    const rows = await getPrisma().careGuide.findMany({
      where: { status: "published" },
      orderBy: { title: "asc" },
    });
    return rows.map(mapCare);
  } catch {
    return getSeedCareGuides().filter((c) => c.status === "published");
  }
}

export async function getAdminCare(): Promise<CareRecord[]> {
  if (!hasDatabase()) return getSeedCareGuides();
  try {
    const rows = await getPrisma().careGuide.findMany({ orderBy: { title: "asc" } });
    return rows.map(mapCare);
  } catch {
    return getSeedCareGuides();
  }
}

function mapTestimonial(row: {
  id: string;
  quote: string;
  authorName: string;
  rating: number;
  source: string;
  sourceUrl: string | null;
  sortOrder: number;
  status: string;
}): TestimonialRecord {
  return {
    id: row.id,
    quote: row.quote,
    authorName: row.authorName,
    rating: row.rating,
    source: row.source,
    sourceUrl: row.sourceUrl,
    sortOrder: row.sortOrder,
    status: row.status,
  };
}

export async function getPublishedTestimonials(): Promise<TestimonialRecord[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().testimonial.findMany({
      where: { status: "published" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapTestimonial);
  } catch {
    return [];
  }
}

export async function getAdminTestimonials(): Promise<TestimonialRecord[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().testimonial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapTestimonial);
  } catch {
    return [];
  }
}

export async function getInquiryStats() {
  if (!hasDatabase()) return { total: 0, unread: 0, recent: [] as InquiryRow[] };
  try {
    const db = getPrisma();
    const [total, unread, recent] = await Promise.all([
      db.inquiry.count(),
      db.inquiry.count({ where: { status: "new" } }),
      db.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    return {
      total,
      unread,
      recent: recent.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        serviceInterest: row.serviceInterest,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        message: row.message,
      })),
    };
  } catch {
    return { total: 0, unread: 0, recent: [] as InquiryRow[] };
  }
}

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  serviceInterest: string | null;
  status: string;
  createdAt: string;
  message: string;
};

export type DashboardAppointment = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientEmail: string;
  serviceTitle: string;
  staffName: string | null;
};

export async function getAppointmentDashboard() {
  if (!hasDatabase()) {
    return {
      upcomingCount: 0,
      todayCount: 0,
      pendingPayment: 0,
      confirmedToday: 0,
      upcoming: [] as DashboardAppointment[],
    };
  }
  try {
    const db = getPrisma();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 14);

    const activeStatuses = ["confirmed", "pending_payment"] as const;

    const [upcomingCount, todayCount, pendingPayment, upcoming] = await Promise.all([
      db.appointment.count({
        where: {
          startsAt: { gte: now },
          status: { in: [...activeStatuses] },
        },
      }),
      db.appointment.count({
        where: {
          startsAt: { gte: startOfToday, lte: endOfToday },
          status: { in: [...activeStatuses, "completed"] },
        },
      }),
      db.appointment.count({ where: { status: "pending_payment" } }),
      db.appointment.findMany({
        where: {
          startsAt: { gte: now, lte: horizon },
          status: { in: [...activeStatuses] },
        },
        orderBy: { startsAt: "asc" },
        take: 8,
        include: {
          service: { select: { title: true } },
          staff: { select: { name: true } },
        },
      }),
    ]);

    return {
      upcomingCount,
      todayCount,
      pendingPayment,
      confirmedToday: todayCount,
      upcoming: upcoming.map((row) => ({
        id: row.id,
        status: row.status,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        serviceTitle: row.serviceLabel || row.service.title,
        staffName: row.staff?.name || null,
      })),
    };
  } catch {
    return {
      upcomingCount: 0,
      todayCount: 0,
      pendingPayment: 0,
      confirmedToday: 0,
      upcoming: [] as DashboardAppointment[],
    };
  }
}
