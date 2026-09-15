import type { Database } from "@/lib/db";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type CouponValidation =
  | {
      ok: true;
      coupon: {
        id: string;
        code: string;
        type: string;
        amount: number;
      };
      discountCents: number;
    }
  | { ok: false; error: string };

export async function validateCoupon(
  db: Database,
  rawCode: string,
  subtotalCents: number,
): Promise<CouponValidation> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code" };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "Invalid coupon code" };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "Coupon is not active yet" };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "Coupon has expired" };
  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return { ok: false, error: "Coupon has reached its redemption limit" };
  }
  if (coupon.minSubtotalCents != null && subtotalCents < coupon.minSubtotalCents) {
    return { ok: false, error: "Order total is too low for this coupon" };
  }

  let discountCents = 0;
  if (coupon.type === "percent") {
    discountCents = Math.round((subtotalCents * coupon.amount) / 10000);
  } else if (coupon.type === "fixed") {
    discountCents = coupon.amount;
  } else {
    return { ok: false, error: "Invalid coupon type" };
  }

  discountCents = Math.max(0, Math.min(subtotalCents, discountCents));
  return {
    ok: true,
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, amount: coupon.amount },
    discountCents,
  };
}

export function applyDiscountToCharge(input: {
  priceCents: number;
  depositCents: number | null;
  baseCents: number;
  taxCents: number;
  totalCents: number;
  paymentMode: string;
  discountCents: number;
  hstRateBps: number;
}) {
  const discount = Math.max(0, Math.min(input.baseCents, input.discountCents));
  const baseCents = Math.max(0, input.baseCents - discount);
  const taxCents = Math.round((baseCents * input.hstRateBps) / 10000);
  return {
    priceCents: input.priceCents,
    depositCents: input.depositCents,
    baseCents,
    taxCents,
    totalCents: baseCents + taxCents,
    paymentMode: input.paymentMode,
    discountCents: discount,
  };
}
