import type { PrismaClient } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
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
  const rows = await db.staffService.findMany({
    where: { serviceId: { in: serviceIds }, admin: { active: true } },
    include: { admin: { select: { id: true, name: true, weeklyHours: true } } },
  });

  const byAdmin = new Map<string, { admin: (typeof rows)[number]["admin"]; count: number }>();
  for (const row of rows) {
    const cur = byAdmin.get(row.adminId);
    if (cur) cur.count += 1;
    else byAdmin.set(row.adminId, { admin: row.admin, count: 1 });
  }

  return [...byAdmin.values()]
    .filter((v) => v.count === serviceIds.length)
    .map((v) => v.admin)
    .sort((a, b) => a.name.localeCompare(b.name));
}
