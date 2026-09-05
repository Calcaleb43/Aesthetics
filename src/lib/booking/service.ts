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
  });
}
