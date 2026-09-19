import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { weeklyWindowSchema } from "@/lib/booking/weekly-hours";

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid(),
  couponId: z.string().uuid(),
  closed: z.boolean().default(false),
  windows: z.array(weeklyWindowSchema).default([]),
  note: z.string().max(200).optional(),
  active: z.boolean().default(true),
  serviceIds: z.array(z.string().uuid()).min(1),
});

function serialize(row: {
  id: string;
  date: string;
  staffId: string;
  couponId: string | null;
  closed: boolean;
  windows: unknown;
  note: string;
  active: boolean;
  staff?: { id: string; name: string } | null;
  coupon?: { id: string; code: string; name: string } | null;
  services: { serviceId: string; service: { id: string; title: string } }[];
}) {
  return {
    id: row.id,
    date: row.date,
    staffId: row.staffId,
    staffName: row.staff?.name || null,
    couponId: row.couponId,
    couponCode: row.coupon?.code || null,
    couponName: row.coupon?.name || null,
    closed: row.closed,
    windows: Array.isArray(row.windows) ? row.windows : [],
    note: row.note,
    active: row.active,
    serviceIds: row.services.map((s) => s.serviceId),
    services: row.services.map((s) => ({ id: s.service.id, title: s.service.title })),
  };
}

const include = {
  staff: { select: { id: true, name: true } },
  coupon: { select: { id: true, code: true, name: true } },
  services: {
    include: { service: { select: { id: true, title: true } } },
  },
} as const;

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const staffId = url.searchParams.get("staffId");
  const couponId = url.searchParams.get("couponId");

  const rows = await gate.db.promoDay.findMany({
    where: {
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
      ...(staffId ? { staffId } : {}),
      ...(couponId ? { couponId } : {}),
    },
    include,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 400,
  });

  const [staff, services, coupons] = await Promise.all([
    gate.db.admin.findMany({
      where: { active: true, role: { in: ["staff", "owner", "manager"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    gate.db.service.findMany({
      where: { bookable: true, status: "published" },
      select: { id: true, title: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      take: 300,
    }),
    gate.db.coupon.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    promoDays: rows.map(serialize),
    staff,
    services,
    coupons,
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const staff = await gate.db.admin.findFirst({
    where: { id: parsed.data.staffId, active: true },
    select: { id: true },
  });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const serviceIds = [...new Set(parsed.data.serviceIds)];
  const services = await gate.db.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true },
  });
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
  }

  if (parsed.data.couponId) {
    const coupon = await gate.db.coupon.findUnique({
      where: { id: parsed.data.couponId },
      select: { id: true },
    });
    if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }

  const data = {
    date: parsed.data.date,
    staffId: parsed.data.staffId,
    couponId: parsed.data.couponId,
    closed: parsed.data.closed,
    windows: parsed.data.closed ? [] : parsed.data.windows,
    note: parsed.data.note || "",
    active: parsed.data.active,
  };

  let row;
  if (parsed.data.id) {
    const existing = await gate.db.promoDay.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await gate.db.promoDayService.deleteMany({ where: { promoDayId: existing.id } });
    row = await gate.db.promoDay.update({
      where: { id: existing.id },
      data: {
        ...data,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include,
    });
  } else {
    row = await gate.db.promoDay.create({
      data: {
        ...data,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include,
    });
  }

  revalidateSite();
  return NextResponse.json({ ok: true, promoDay: serialize(row) });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.promoDay.delete({ where: { id: parsed.data.id } }).catch(() => null);
  revalidateSite();
  return NextResponse.json({ ok: true });
}
