import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  normalizeStaffWeeklyHours,
  weeklyHoursSchema,
} from "@/lib/booking/weekly-hours";
import { Prisma } from "@/generated/prisma/client";

function weeklyHoursWriteValue(value: unknown) {
  const normalized = normalizeStaffWeeklyHours(value);
  return normalized === null ? Prisma.DbNull : normalized;
}

export async function GET() {
  const gate = await requireAdminApi({ permission: "team" });
  if ("error" in gate) return gate.error;

  const rows = await gate.db.admin.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      services: { include: { service: { select: { id: true, title: true, slug: true } } } },
    },
  });

  return NextResponse.json({
    members: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      active: row.active,
      color: row.color,
      phone: row.phone,
      weeklyHours: normalizeStaffWeeklyHours(row.weeklyHours),
      serviceIds: row.services.map((s) => s.serviceId),
      services: row.services.map((s) => ({
        id: s.service.id,
        title: s.service.title,
        slug: s.service.slug,
      })),
    })),
  });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8),
  role: z.enum(ADMIN_ROLES as [string, ...string[]]),
  color: z.string().max(32).optional(),
  phone: z.string().max(64).nullable().optional(),
  active: z.boolean().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  weeklyHours: weeklyHoursSchema.nullable().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "team" });
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await gate.db.admin.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const weeklyHours =
    parsed.data.weeklyHours === undefined
      ? undefined
      : weeklyHoursWriteValue(parsed.data.weeklyHours);

  const member = await gate.db.admin.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash,
      role: parsed.data.role,
      color: parsed.data.color || "#c6a75e",
      phone: parsed.data.phone || null,
      active: parsed.data.active ?? true,
      ...(weeklyHours !== undefined ? { weeklyHours } : {}),
      services: parsed.data.serviceIds?.length
        ? {
            create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })),
          }
        : undefined,
    },
  });

  return NextResponse.json({ ok: true, id: member.id });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ADMIN_ROLES as [string, ...string[]]).optional(),
  color: z.string().max(32).optional(),
  phone: z.string().max(64).nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  weeklyHours: weeklyHoursSchema.nullable().optional(),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi({ permission: "team" });
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const target = await gate.db.admin.findUnique({ where: { id: parsed.data.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "owner" && parsed.data.role && parsed.data.role !== "owner") {
    const owners = await gate.db.admin.count({ where: { role: "owner", active: true } });
    if (owners <= 1) {
      return NextResponse.json({ error: "Cannot demote the last owner" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.color !== undefined) data.color = parsed.data.color;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (parsed.data.weeklyHours !== undefined) {
    data.weeklyHours = weeklyHoursWriteValue(parsed.data.weeklyHours);
  }

  await gate.db.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: parsed.data.id }, data });
    if (parsed.data.serviceIds) {
      await tx.staffService.deleteMany({ where: { adminId: parsed.data.id } });
      if (parsed.data.serviceIds.length) {
        await tx.staffService.createMany({
          data: parsed.data.serviceIds.map((serviceId) => ({
            adminId: parsed.data.id,
            serviceId,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "team" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  if (parsed.data.id === gate.session.sub) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const target = await gate.db.admin.findUnique({ where: { id: parsed.data.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "owner") {
    const owners = await gate.db.admin.count({ where: { role: "owner", active: true } });
    if (owners <= 1) {
      return NextResponse.json({ error: "Cannot delete the last owner" }, { status: 400 });
    }
  }

  await gate.db.admin.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
