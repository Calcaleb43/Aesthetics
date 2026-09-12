import { getPrisma, hasDatabase } from "@/lib/db";
import { asWeeklyHours } from "@/lib/booking/money";
import {
  getSeedBookableServices,
  getSeedCare,
  getSeedCareGuides,
  getSeedCategories,
  getSeedCategory,
  getSeedFaq,
  getSeedFaqs,
  getSeedPage,
  getSeedPages,
  getSeedSettings,
  type CareRecord,
  type CategoryRecord,
  type FaqRecord,
  type PaymentMode,
  type PageRecord,
  type AddonRecord,
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

function mapCategory(row: {
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
}): CategoryRecord {
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
  };
}

function mapBookableService(row: {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  status: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  bookable: boolean;
  categoryId?: string;
  category?: { slug: string } | null;
  categorySlug?: string;
  variants?: {
    id?: string;
    slug: string;
    title: string;
    summary: string;
    sortOrder: number;
    status: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number | null;
    paymentMode: string;
    bookable: boolean;
  }[];
}): ServiceRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary || "",
    sortOrder: row.sortOrder,
    status: row.status,
    categorySlug: row.categorySlug || row.category?.slug || "",
    categoryId: row.categoryId,
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    depositCents: row.depositCents,
    paymentMode: (row.paymentMode as PaymentMode) || "deposit",
    bookable: row.bookable,
    variants: (row.variants || []).map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      summary: v.summary || "",
      sortOrder: v.sortOrder,
      status: v.status,
      durationMinutes: v.durationMinutes,
      priceCents: v.priceCents,
      depositCents: v.depositCents,
      paymentMode: (v.paymentMode as PaymentMode) || "deposit",
      bookable: v.bookable,
    })),
  };
}

function mapAddon(row: {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  status: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  bookable: boolean;
  categories?: { category: { slug: string } }[];
  categorySlugs?: string[];
}): AddonRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary || "",
    sortOrder: row.sortOrder,
    status: row.status,
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    depositCents: row.depositCents,
    paymentMode: (row.paymentMode as PaymentMode) || "deposit",
    bookable: row.bookable,
    categorySlugs:
      row.categorySlugs ||
      (row.categories || []).map((c) => c.category.slug).filter(Boolean),
  };
}

function mapFaq(row: {
  categorySlug: string;
  title: string;
  intro: string;
  status: string;
  items: unknown;
}): FaqRecord {
  return {
    categorySlug: row.categorySlug,
    title: row.title,
    intro: row.intro,
    status: row.status,
    items: asFaqItems(row.items),
  };
}

function mapCare(row: {
  categorySlug: string;
  title: string;
  status: string;
  content: string;
  coverImage: string | null;
}): CareRecord {
  return {
    categorySlug: row.categorySlug,
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

export async function getPublishedCategories(): Promise<CategoryRecord[]> {
  if (!hasDatabase()) return getSeedCategories().filter((s) => s.status === "published");
  try {
    const rows = await getPrisma().serviceCategory.findMany({
      where: {
        status: "published",
        NOT: { slug: "imported-acuity" },
      },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapCategory);
  } catch {
    return getSeedCategories().filter((s) => s.status === "published");
  }
}

export async function getFeaturedCategories(): Promise<CategoryRecord[]> {
  const published = await getPublishedCategories();
  const featured = published.filter((s) => s.featured !== false);
  return featured.length ? featured : published;
}

export async function getAdminCategories(): Promise<CategoryRecord[]> {
  if (!hasDatabase()) return getSeedCategories();
  try {
    const rows = await getPrisma().serviceCategory.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map(mapCategory);
  } catch {
    return getSeedCategories();
  }
}

export async function getCategory(slug: string): Promise<CategoryRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedCategory(slug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().serviceCategory.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return null;
    return mapCategory(row);
  } catch {
    const seed = getSeedCategory(slug);
    return seed?.status === "published" ? seed : null;
  }
}

/** Public marketing “services” = categories */
export async function getPublishedServices(): Promise<CategoryRecord[]> {
  return getPublishedCategories();
}

export async function getFeaturedServices(): Promise<CategoryRecord[]> {
  return getFeaturedCategories();
}

export async function getService(slug: string): Promise<CategoryRecord | null> {
  return getCategory(slug);
}

export async function getAdminBookableServices(): Promise<ServiceRecord[]> {
  if (!hasDatabase()) return getSeedBookableServices();
  try {
    const rows = await getPrisma().service.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: { select: { slug: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    });
    return rows.map(mapBookableService);
  } catch {
    return getSeedBookableServices();
  }
}

export async function getAdminAddons(): Promise<AddonRecord[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().addon.findMany({
      orderBy: { sortOrder: "asc" },
      include: { categories: { include: { category: { select: { slug: true } } } } },
    });
    return rows.map(mapAddon);
  } catch {
    return [];
  }
}

export async function getPublishedBookableServices(categorySlug?: string): Promise<ServiceRecord[]> {
  if (!hasDatabase()) {
    return getSeedBookableServices().filter(
      (s) =>
        s.status === "published" &&
        s.bookable &&
        (!categorySlug || s.categorySlug === categorySlug),
    );
  }
  try {
    const rows = await getPrisma().service.findMany({
      where: {
        status: "published",
        bookable: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: { select: { slug: true } },
        variants: {
          where: { status: "published", bookable: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return rows.map(mapBookableService);
  } catch {
    return getSeedBookableServices().filter(
      (s) =>
        s.status === "published" &&
        s.bookable &&
        (!categorySlug || s.categorySlug === categorySlug),
    );
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

export async function getFaq(categorySlug: string): Promise<FaqRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedFaq(categorySlug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().faq.findUnique({ where: { categorySlug } });
    if (!row || row.status !== "published") return null;
    return mapFaq(row);
  } catch {
    const seed = getSeedFaq(categorySlug);
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

export async function getCare(categorySlug: string): Promise<CareRecord | null> {
  if (!hasDatabase()) {
    const seed = getSeedCare(categorySlug);
    return seed?.status === "published" ? seed : null;
  }
  try {
    const row = await getPrisma().careGuide.findUnique({ where: { categorySlug } });
    if (!row || row.status !== "published") return null;
    return mapCare(row);
  } catch {
    const seed = getSeedCare(categorySlug);
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

function appointmentTitle(row: {
  serviceLabel: string | null;
  service: { title: string } | null;
  lines: { title: string }[];
  category: { title: string } | null;
}) {
  if (row.serviceLabel) return row.serviceLabel;
  if (row.lines.length) return row.lines.map((l) => l.title).join(", ");
  if (row.service?.title) return row.service.title;
  return row.category?.title || "Appointment";
}

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
          category: { select: { title: true } },
          staff: { select: { name: true } },
          lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
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
        serviceTitle: appointmentTitle(row),
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
