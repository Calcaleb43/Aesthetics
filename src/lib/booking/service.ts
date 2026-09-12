import type { PrismaClient } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export type BookingItemInput = {
  serviceId: string;
  variantIds?: string[];
};

export type ResolvedBookingLine = {
  serviceId: string;
  variantId: string | null;
  categoryId: string;
  title: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
};

/** Normalize checkout/availability payloads into booking items. */
export function normalizeBookingItems(input: {
  items?: BookingItemInput[] | null;
  serviceIds?: string[] | null;
}): BookingItemInput[] | null {
  if (input.items?.length) {
    const seen = new Set<string>();
    const items: BookingItemInput[] = [];
    for (const item of input.items) {
      const serviceId = item.serviceId?.trim();
      if (!serviceId || seen.has(serviceId)) continue;
      seen.add(serviceId);
      items.push({
        serviceId,
        variantIds: [...new Set((item.variantIds || []).map((id) => id.trim()).filter(Boolean))],
      });
    }
    return items.length ? items : null;
  }

  const ids = [...new Set((input.serviceIds || []).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return null;
  return ids.map((serviceId) => ({ serviceId, variantIds: [] }));
}

/**
 * Resolve bookable appointment lines from services (+ optional variants).
 * When a service has published bookable variants and requireVariants is true,
 * at least one valid variant is required and pricing comes from those variants.
 */
export async function resolveBookingItems(
  db: PrismaClient,
  items: BookingItemInput[],
  opts?: { requireVariants?: boolean; publishedOnly?: boolean },
): Promise<ResolvedBookingLine[] | null> {
  const requireVariants = opts?.requireVariants !== false;
  const publishedOnly = opts?.publishedOnly !== false;
  const normalized = normalizeBookingItems({ items });
  if (!normalized?.length) return null;

  const serviceIds = normalized.map((i) => i.serviceId);
  const rows = await db.service.findMany({
    where: {
      id: { in: serviceIds },
      ...(publishedOnly ? { status: "published", bookable: true } : {}),
    },
    include: {
      category: true,
      variants: {
        where: publishedOnly ? { status: "published", bookable: true } : undefined,
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  if (rows.length !== serviceIds.length) return null;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines: ResolvedBookingLine[] = [];

  for (const item of normalized) {
    const service = byId.get(item.serviceId);
    if (!service) return null;

    const publishedVariants = service.variants;
    const requested = item.variantIds || [];

    if (publishedVariants.length > 0) {
      if (requireVariants && !requested.length) return null;
      if (requested.length) {
        const variantById = new Map(publishedVariants.map((v) => [v.id, v]));
        if (requested.length !== new Set(requested).size) return null;
        for (const variantId of requested) {
          const variant = variantById.get(variantId);
          if (!variant) return null;
          lines.push({
            serviceId: service.id,
            variantId: variant.id,
            categoryId: service.categoryId,
            title: `${service.title}: ${variant.title}`.slice(0, 200),
            durationMinutes: variant.durationMinutes,
            priceCents: variant.priceCents,
            depositCents: variant.depositCents,
            paymentMode: variant.paymentMode,
          });
        }
        continue;
      }
    } else if (requested.length) {
      return null;
    }

    lines.push({
      serviceId: service.id,
      variantId: null,
      categoryId: service.categoryId,
      title: service.title,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      depositCents: service.depositCents,
      paymentMode: service.paymentMode,
    });
  }

  return lines;
}

/** Resolve a published bookable service by UUID id or slug. */
export async function findBookableService(db: PrismaClient, serviceIdOrSlug: string) {
  const key = serviceIdOrSlug.trim();
  if (!key) return null;

  return db.service.findFirst({
    where: {
      status: "published",
      bookable: true,
      ...(isUuid(key) ? { id: key } : { slug: key }),
    },
    include: { category: true },
  });
}

/** Resolve many published bookable services (any mix of categories). */
export async function findBookableServices(db: PrismaClient, serviceIds: string[]) {
  const ids = [...new Set(serviceIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return null;

  const rows = await db.service.findMany({
    where: {
      id: { in: ids },
      status: "published",
      bookable: true,
    },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  if (rows.length !== ids.length) return null;
  return rows;
}

/** Resolve published bookable addons; optionally filter to those eligible for selected category ids. */
export async function findBookableAddons(db: PrismaClient, addonIds: string[], categoryIds?: string[]) {
  const ids = [...new Set(addonIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return [];

  const rows = await db.addon.findMany({
    where: {
      id: { in: ids },
      status: "published",
      bookable: true,
    },
    include: { categories: { select: { categoryId: true } } },
    orderBy: { sortOrder: "asc" },
  });

  if (rows.length !== ids.length) return null;

  if (categoryIds?.length) {
    const allowed = new Set(categoryIds);
    for (const row of rows) {
      if (!row.categories.length) continue;
      if (!row.categories.some((c) => allowed.has(c.categoryId))) return null;
    }
  }

  return rows;
}

export async function listEligibleAddons(db: PrismaClient, categoryIds: string[]) {
  const rows = await db.addon.findMany({
    where: { status: "published", bookable: true },
    include: { categories: { select: { categoryId: true, category: { select: { slug: true } } } } },
    orderBy: { sortOrder: "asc" },
  });

  if (!categoryIds.length) return rows.filter((r) => !r.categories.length);

  const allowed = new Set(categoryIds);
  return rows.filter((row) => !row.categories.length || row.categories.some((c) => allowed.has(c.categoryId)));
}

export async function findPublishedCategory(db: PrismaClient, categoryIdOrSlug: string) {
  const key = categoryIdOrSlug.trim();
  if (!key) return null;
  return db.serviceCategory.findFirst({
    where: {
      status: "published",
      ...(isUuid(key) ? { id: key } : { slug: key }),
    },
  });
}

/** Staff who can perform every selected service (intersection). */
export async function staffForAllServices(db: PrismaClient, serviceIds: string[]) {
  if (!serviceIds.length) return [];
  const unique = [...new Set(serviceIds)];
  const rows = await db.staffService.findMany({
    where: { serviceId: { in: unique }, admin: { active: true } },
    include: { admin: { select: { id: true, name: true, weeklyHours: true } } },
  });

  const byAdmin = new Map<string, { admin: (typeof rows)[number]["admin"]; count: number }>();
  for (const row of rows) {
    const cur = byAdmin.get(row.adminId);
    if (cur) cur.count += 1;
    else byAdmin.set(row.adminId, { admin: row.admin, count: 1 });
  }

  return [...byAdmin.values()]
    .filter((v) => v.count === unique.length)
    .map((v) => v.admin)
    .sort((a, b) => a.name.localeCompare(b.name));
}
