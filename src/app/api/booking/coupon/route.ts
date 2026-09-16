import { NextResponse } from "next/server";
import { z } from "zod";
import { couponLabel, validateCoupon } from "@/lib/booking/coupons";
import { formatCad } from "@/lib/booking/money";
import { getPrisma, hasDatabase } from "@/lib/db";

const schema = z.object({
  code: z.string().min(1).max(64),
  /** Full services+addons subtotal in cents (before tax) — not the deposit */
  subtotalCents: z.number().int().min(0),
});

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Booking unavailable" }, { status: 503 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getPrisma();
  const validated = await validateCoupon(db, parsed.data.code, parsed.data.subtotalCents);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    code: validated.coupon.code,
    type: validated.coupon.type,
    amount: validated.coupon.amount,
    name: validated.coupon.name || validated.coupon.code,
    discountCents: validated.discountCents,
    discountLabel: formatCad(validated.discountCents),
    label: couponLabel(validated.coupon),
  });
}
