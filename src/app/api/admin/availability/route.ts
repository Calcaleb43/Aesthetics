import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { asWeeklyHours } from "@/lib/booking/money";
import {
  normalizeStaffWeeklyHours,
  weeklyHoursSchema,
} from "@/lib/booking/weekly-hours";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  const [settings, staff] = await Promise.all([
    gate.db.siteSettings.findUnique({ where: { id: 1 } }),
    gate.db.admin.findMany({
      where: { active: true, role: { in: ["staff", "owner", "manager"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        color: true,
        weeklyHours: true,
      },
    }),
  ]);

  return NextResponse.json({
    canEditRules: gate.session.role === "owner" || gate.session.role === "manager",
    canEditStaffHours: gate.session.role === "owner" || gate.session.role === "manager",
    timezone: settings?.timezone || "America/Toronto",
    bookingEnabled: settings?.bookingEnabled ?? true,
    slotIntervalMinutes: settings?.slotIntervalMinutes ?? 30,
    bufferMinutes: settings?.bufferMinutes ?? 15,
    minLeadHours: settings?.minLeadHours ?? 24,
    maxAdvanceDays: settings?.maxAdvanceDays ?? 60,
    studioWeeklyHours: asWeeklyHours(settings?.weeklyHours),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      color: s.color,
      weeklyHours: normalizeStaffWeeklyHours(s.weeklyHours),
    })),
  });
}

const putSchema = z.object({
  studioWeeklyHours: weeklyHoursSchema.optional(),
  bookingEnabled: z.boolean().optional(),
  slotIntervalMinutes: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  minLeadHours: z.number().int().min(0).optional(),
  maxAdvanceDays: z.number().int().positive().optional(),
  timezone: z.string().min(1).max(64).optional(),
  staffHours: z
    .array(
      z.object({
        id: z.string().uuid(),
        weeklyHours: weeklyHoursSchema.nullable(),
      }),
    )
    .optional(),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_all" });
  if ("error" in gate) return gate.error;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const body = parsed.data;
  const settingsPatch: Prisma.SiteSettingsUpdateInput = {};

  if (body.studioWeeklyHours !== undefined) settingsPatch.weeklyHours = body.studioWeeklyHours;
  if (body.bookingEnabled !== undefined) settingsPatch.bookingEnabled = body.bookingEnabled;
  if (body.slotIntervalMinutes !== undefined) settingsPatch.slotIntervalMinutes = body.slotIntervalMinutes;
  if (body.bufferMinutes !== undefined) settingsPatch.bufferMinutes = body.bufferMinutes;
  if (body.minLeadHours !== undefined) settingsPatch.minLeadHours = body.minLeadHours;
  if (body.maxAdvanceDays !== undefined) settingsPatch.maxAdvanceDays = body.maxAdvanceDays;
  if (body.timezone !== undefined) settingsPatch.timezone = body.timezone.trim();

  if (Object.keys(settingsPatch).length) {
    const existing = await gate.db.siteSettings.findUnique({ where: { id: 1 } });
    if (!existing) {
      return NextResponse.json({ error: "Site settings not found — seed the database first" }, { status: 404 });
    }
    await gate.db.siteSettings.update({
      where: { id: 1 },
      data: settingsPatch,
    });
  }

  if (body.staffHours?.length) {
    for (const row of body.staffHours) {
      const normalized = normalizeStaffWeeklyHours(row.weeklyHours);
      await gate.db.admin.update({
        where: { id: row.id },
        data: { weeklyHours: normalized === null ? Prisma.DbNull : normalized },
      });
    }
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}
