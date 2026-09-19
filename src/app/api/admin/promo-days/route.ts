import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { formatCad } from "@/lib/booking/money";
import { weeklyWindowSchema } from "@/lib/booking/weekly-hours";

const serviceEntrySchema = z.object({
  serviceId: z.string().uuid(),
  /** Reduced base/unit price in cents; null = keep regular price */
  promoPriceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid(),
  couponId: z.string().uuid().nullable().optional(),
  closed: z.boolean().default(false),
  windows: z.array(weeklyWindowSchema).default([]),
  note: z.string().max(200).optional(),
  active: z.boolean().default(true),
  services: z.array(serviceEntrySchema).min(1),
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
  coupon?: { id: string; code: string; name: string; type: string; amount: number } | null;
  services: {
    serviceId: string;
    promoPriceCents: number | null;
    service: { id: string; title: string; priceCents: number };
  }[];
}) {
  return {
    id: row.id,
    date: row.date,
    staffId: row.staffId,
    staffName: row.staff?.name || null,
    couponId: row.couponId,
    couponCode: row.coupon?.code || null,
    couponName: row.coupon?.name || null,
    couponType: row.coupon?.type || null,
    couponAmount: row.coupon?.amount ?? null,
    closed: row.closed,
    windows: Array.isArray(row.windows) ? row.windows : [],
    note: row.note,
    active: row.active,
    serviceIds: row.services.map((s) => s.serviceId),
    services: row.services.map((s) => ({
      id: s.service.id,
      title: s.service.title,
      regularPriceCents: s.service.priceCents,
      regularPriceLabel: formatCad(s.service.priceCents),
      promoPriceCents: s.promoPriceCents,
      promoPriceLabel:
        s.promoPriceCents != null ? formatCad(s.promoPriceCents) : null,
    })),
  };
}

const include = {
  staff: { select: { id: true, name: true } },
  coupon: { select: { id: true, code: true, name: true, type: true, amount: true } },
  services: {
    include: { service: { select: { id: true, title: true, priceCents: true } } },
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
      select: { id: true, title: true, priceCents: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      take: 300,
    }),
    gate.db.coupon.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, type: true, amount: true },
      orderBy: { code: "asc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    promoDays: rows.map(serialize),
    staff,
    services: services.map((s) => ({
      id: s.id,
      title: s.title,
      priceCents: s.priceCents,
      priceLabel: formatCad(s.priceCents),
    })),
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

  const entries = parsed.data.services;
  const serviceIds = [...new Set(entries.map((e) => e.serviceId))];
  if (serviceIds.length !== entries.length) {
    return NextResponse.json({ error: "Duplicate services in promo day" }, { status: 400 });
  }

  const services = await gate.db.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true },
  });
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
  }

  const hasPriceOverrides = entries.some(
    (e) => e.promoPriceCents != null && e.promoPriceCents >= 0,
  );
  if (!parsed.data.couponId && !hasPriceOverrides) {
    return NextResponse.json(
      { error: "Add a coupon (percent or fixed $) and/or set promo prices on services" },
      { status: 400 },
    );
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
    couponId: parsed.data.couponId ?? null,
    closed: parsed.data.closed,
    windows: parsed.data.closed ? [] : parsed.data.windows,
    note: parsed.data.note || "",
    active: parsed.data.active,
  };

  const serviceCreates = entries.map((e) => ({
    serviceId: e.serviceId,
    promoPriceCents: e.promoPriceCents ?? null,
  }));

  let row;
  if (parsed.data.id) {
    const existing = await gate.db.promoDay.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await gate.db.promoDayService.deleteMany({ where: { promoDayId: existing.id } });
    row = await gate.db.promoDay.update({
      where: { id: existing.id },
      data: {
        ...data,
        services: { create: serviceCreates },
      },
      include,
    });
  } else {
    row = await gate.db.promoDay.create({
      data: {
        ...data,
        services: { create: serviceCreates },
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
