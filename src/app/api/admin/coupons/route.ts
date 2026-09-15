import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { normalizeCouponCode } from "@/lib/booking/coupons";

function parseOptionalDate(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

const schema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  type: z.enum(["percent", "fixed"]),
  /** Percent: basis points (2000 = 20%). Fixed: cents off. */
  amount: z.number().int().min(0),
  active: z.boolean().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  maxRedemptions: z.number().int().min(0).nullable().optional(),
  minSubtotalCents: z.number().int().min(0).nullable().optional(),
});

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const rows = await gate.db.coupon.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
  });

  return NextResponse.json({
    coupons: rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      amount: c.amount,
      active: c.active,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      maxRedemptions: c.maxRedemptions,
      redeemedCount: c.redeemedCount,
      minSubtotalCents: c.minSubtotalCents,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const code = normalizeCouponCode(parsed.data.code);
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  if (parsed.data.type === "percent" && parsed.data.amount > 10000) {
    return NextResponse.json({ error: "Percent amount cannot exceed 10000 bps (100%)" }, { status: 400 });
  }

  const startsAt = parseOptionalDate(parsed.data.startsAt);
  const endsAt = parseOptionalDate(parsed.data.endsAt);
  if (startsAt === undefined || endsAt === undefined) {
    return NextResponse.json({ error: "Invalid startsAt or endsAt date" }, { status: 400 });
  }

  const maxRedemptions =
    parsed.data.maxRedemptions == null || parsed.data.maxRedemptions <= 0
      ? null
      : parsed.data.maxRedemptions;

  const data = {
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    amount: parsed.data.amount,
    active: parsed.data.active ?? true,
    startsAt,
    endsAt,
    maxRedemptions,
    minSubtotalCents: parsed.data.minSubtotalCents ?? null,
  };

  await gate.db.coupon.upsert({
    where: { code },
    create: { code, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      code: z.string().min(1).optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { id, code } = parsed.data;
  if (!id && !code) {
    return NextResponse.json({ error: "id or code required" }, { status: 400 });
  }

  if (id) {
    await gate.db.coupon.delete({ where: { id } });
  } else {
    await gate.db.coupon.delete({ where: { code: normalizeCouponCode(code!) } });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}
