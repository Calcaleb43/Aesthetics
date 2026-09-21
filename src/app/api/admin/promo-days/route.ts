import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { formatCad } from "@/lib/booking/money";
import {
  expandPromoOccurrenceDates,
  promoEndDate,
  promoPriceKey,
  recurrenceLabel,
} from "@/lib/booking/promo-days";
import { weeklyWindowSchema } from "@/lib/booking/weekly-hours";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const serviceEntrySchema = z.object({
  serviceId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  /** Reduced base/unit price in cents; null = keep regular price */
  promoPriceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(dateRe),
  endDate: z.string().regex(dateRe).optional(),
  recurrence: z.enum(["none", "weekly", "biweekly", "monthly"]).default("none"),
  staffId: z.string().uuid(),
  couponId: z.string().uuid().nullable().optional(),
  closed: z.boolean().default(false),
  windows: z.array(weeklyWindowSchema).default([]),
  note: z.string().max(200).optional(),
  active: z.boolean().default(true),
  services: z.array(serviceEntrySchema).min(1),
  /**
   * When set, materialize separate one-off promo days for each occurrence
   * (weekly/monthly copies) instead of storing a single recurring rule.
   */
  materialize: z.boolean().optional(),
});

const duplicateSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["weekly", "biweekly", "monthly"]),
  count: z.number().int().min(1).max(52).default(8),
});

function serialize(row: {
  id: string;
  date: string;
  endDate: string;
  recurrence: string;
  seriesId: string | null;
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
    variantId: string | null;
    variantKey: string;
    promoPriceCents: number | null;
    service: { id: string; title: string; priceCents: number };
    variant?: { id: string; title: string; priceCents: number } | null;
  }[];
}) {
  const end = promoEndDate(row);
  return {
    id: row.id,
    date: row.date,
    endDate: end,
    recurrence: row.recurrence || "none",
    recurrenceLabel: recurrenceLabel(row.recurrence),
    seriesId: row.seriesId,
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
    serviceIds: [...new Set(row.services.map((s) => s.serviceId))],
    services: row.services.map((s) => {
      const regular = s.variant?.priceCents ?? s.service.priceCents;
      return {
        id: s.service.id,
        serviceId: s.serviceId,
        variantId: s.variantId,
        title: s.variant ? `${s.service.title} — ${s.variant.title}` : s.service.title,
        serviceTitle: s.service.title,
        variantTitle: s.variant?.title || null,
        regularPriceCents: regular,
        regularPriceLabel: formatCad(regular),
        promoPriceCents: s.promoPriceCents,
        promoPriceLabel: s.promoPriceCents != null ? formatCad(s.promoPriceCents) : null,
      };
    }),
  };
}

const include = {
  staff: { select: { id: true, name: true } },
  coupon: { select: { id: true, code: true, name: true, type: true, amount: true } },
  services: {
    include: {
      service: { select: { id: true, title: true, priceCents: true } },
      variant: { select: { id: true, title: true, priceCents: true } },
    },
  },
} as const;

function buildServiceCreates(
  entries: z.infer<typeof serviceEntrySchema>[],
) {
  return entries.map((e) => ({
    serviceId: e.serviceId,
    variantId: e.variantId || null,
    variantKey: e.variantId || "",
    promoPriceCents: e.promoPriceCents ?? null,
  }));
}

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
      ...(from && to
        ? {
            date: { lte: to },
            endDate: { gte: from },
          }
        : {}),
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
      select: {
        id: true,
        title: true,
        priceCents: true,
        variants: {
          where: { bookable: true, status: "published" },
          select: { id: true, title: true, priceCents: true },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        },
      },
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
      variants: s.variants.map((v) => ({
        id: v.id,
        title: v.title,
        priceCents: v.priceCents,
        priceLabel: formatCad(v.priceCents),
      })),
    })),
    coupons,
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;
  const body = await req.json().catch(() => null);

  // Duplicate existing promo across weeks/months as separate rows
  if (body && typeof body === "object" && body.action === "duplicate") {
    const parsed = duplicateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid duplicate payload" }, { status: 400 });
    }
    const source = await gate.db.promoDay.findUnique({
      where: { id: parsed.data.id },
      include: { services: true },
    });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const seriesId = source.seriesId || randomUUID();
    if (!source.seriesId) {
      await gate.db.promoDay.update({
        where: { id: source.id },
        data: { seriesId },
      });
    }

    const spanDays =
      Math.max(
        0,
        (parseISOSafe(promoEndDate(source)).getTime() - parseISOSafe(source.date).getTime()) /
          86400000,
      ) || 0;

    const createdIds: string[] = [];
    for (let i = 1; i <= parsed.data.count; i++) {
      const nextStart = shiftDate(source.date, parsed.data.mode, i);
      const nextEnd = shiftDate(source.date, parsed.data.mode, i);
      // Preserve multi-day span
      const endShifted =
        spanDays > 0 ? formatYmd(addDaysLocal(parseISOSafe(nextStart), spanDays)) : nextEnd;

      const row = await gate.db.promoDay.create({
        data: {
          date: nextStart,
          endDate: endShifted,
          recurrence: "none",
          seriesId,
          staffId: source.staffId,
          couponId: source.couponId,
          closed: source.closed,
          windows: source.windows as object,
          note: source.note,
          active: source.active,
          services: {
            create: source.services.map((s) => ({
              serviceId: s.serviceId,
              variantId: s.variantId,
              variantKey: s.variantKey || s.variantId || "",
              promoPriceCents: s.promoPriceCents,
            })),
          },
        },
      });
      createdIds.push(row.id);
    }

    revalidateSite();
    return NextResponse.json({ ok: true, createdIds, seriesId, count: createdIds.length });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const staff = await gate.db.admin.findFirst({
    where: { id: parsed.data.staffId, active: true },
    select: { id: true },
  });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const endDate =
    parsed.data.endDate && parsed.data.endDate >= parsed.data.date
      ? parsed.data.endDate
      : parsed.data.date;

  const entries = parsed.data.services;
  const serviceIds = [...new Set(entries.map((e) => e.serviceId))];
  const services = await gate.db.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true },
  });
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
  }

  const variantIds = [...new Set(entries.map((e) => e.variantId).filter(Boolean))] as string[];
  if (variantIds.length) {
    const variants = await gate.db.serviceVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, serviceId: true },
    });
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "One or more variants not found" }, { status: 400 });
    }
    for (const e of entries) {
      if (!e.variantId) continue;
      const v = variants.find((x) => x.id === e.variantId);
      if (!v || v.serviceId !== e.serviceId) {
        return NextResponse.json({ error: "Variant does not belong to service" }, { status: 400 });
      }
    }
  }

  const keys = new Set(entries.map((e) => promoPriceKey(e.serviceId, e.variantId)));
  if (keys.size !== entries.length) {
    return NextResponse.json({ error: "Duplicate service/variant entries" }, { status: 400 });
  }

  const hasPriceOverrides = entries.some(
    (e) => e.promoPriceCents != null && e.promoPriceCents >= 0,
  );
  if (!parsed.data.couponId && !hasPriceOverrides) {
    return NextResponse.json(
      { error: "Add a coupon (percent or fixed $) and/or set promo prices on services/variants" },
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

  const serviceCreates = buildServiceCreates(entries);
  const baseData = {
    staffId: parsed.data.staffId,
    couponId: parsed.data.couponId ?? null,
    closed: parsed.data.closed,
    windows: parsed.data.closed ? [] : parsed.data.windows,
    note: parsed.data.note || "",
    active: parsed.data.active,
  };

  // Materialize recurring rule into separate one-off days
  if (parsed.data.materialize && parsed.data.recurrence !== "none" && !parsed.data.id) {
    const dates = expandPromoOccurrenceDates({
      startDate: parsed.data.date,
      endDate,
      recurrence: parsed.data.recurrence,
      maxDates: 52,
    });
    const seriesId = randomUUID();
    const created = [];
    for (const d of dates) {
      const row = await gate.db.promoDay.create({
        data: {
          ...baseData,
          date: d,
          endDate: d,
          recurrence: "none",
          seriesId,
          services: { create: serviceCreates },
        },
        include,
      });
      created.push(serialize(row));
    }
    revalidateSite();
    return NextResponse.json({ ok: true, promoDays: created, seriesId });
  }

  let row;
  if (parsed.data.id) {
    const existing = await gate.db.promoDay.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await gate.db.promoDayService.deleteMany({ where: { promoDayId: existing.id } });
    row = await gate.db.promoDay.update({
      where: { id: existing.id },
      data: {
        ...baseData,
        date: parsed.data.date,
        endDate,
        recurrence: parsed.data.recurrence,
        services: { create: serviceCreates },
      },
      include,
    });
  } else {
    row = await gate.db.promoDay.create({
      data: {
        ...baseData,
        date: parsed.data.date,
        endDate,
        recurrence: parsed.data.recurrence,
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
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      seriesId: z.string().uuid().optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  if (parsed.data.seriesId) {
    await gate.db.promoDay.deleteMany({ where: { seriesId: parsed.data.seriesId } });
  } else if (parsed.data.id) {
    await gate.db.promoDay.delete({ where: { id: parsed.data.id } }).catch(() => null);
  } else {
    return NextResponse.json({ error: "id or seriesId required" }, { status: 400 });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}

function parseISOSafe(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysLocal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function shiftDate(ymd: string, mode: "weekly" | "biweekly" | "monthly", times: number) {
  const d = parseISOSafe(ymd);
  if (mode === "monthly") {
    d.setMonth(d.getMonth() + times);
  } else {
    d.setDate(d.getDate() + times * (mode === "biweekly" ? 14 : 7));
  }
  return formatYmd(d);
}
