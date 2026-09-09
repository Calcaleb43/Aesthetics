import { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/lib/db";

export async function notifyAdmins(
  db: Database,
  input: {
    type: string;
    title: string;
    body: string;
    href?: string;
    metadata?: Record<string, unknown>;
    adminIds?: string[];
    includeStaffId?: string | null;
  },
) {
  let adminIds = input.adminIds;
  if (!adminIds) {
    const managers = await db.admin.findMany({
      where: {
        active: true,
        role: { in: ["owner", "manager"] },
      },
      select: { id: true },
    });
    adminIds = managers.map((a) => a.id);
    if (input.includeStaffId && !adminIds.includes(input.includeStaffId)) {
      adminIds.push(input.includeStaffId);
    }
  }

  if (!adminIds.length) return;

  await db.notification.createMany({
    data: adminIds.map((adminId) => ({
      adminId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href || "/admin/appointments",
      metadata: (input.metadata || {}) as Prisma.InputJsonValue,
    })),
  });
}
