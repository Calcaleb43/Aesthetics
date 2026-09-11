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

/** Resolve many published bookable services; all must belong to the same category. */
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
    orderBy: { sortOrder: "asc" },
  });

  if (rows.length !== ids.length) return null;
  const categoryId = rows[0]?.categoryId;
  if (!categoryId || rows.some((r) => r.categoryId !== categoryId)) return null;
  return rows;
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
