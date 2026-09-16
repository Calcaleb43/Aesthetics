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
        name?: string;
      };
      discountCents: number;
    }
  | { ok: false; error: string };

export function couponLabel(coupon: { type: string; amount: number; code: string }) {
  if (coupon.type === "percent") {
    const pct = (coupon.amount / 100).toFixed(coupon.amount % 100 === 0 ? 0 : 2);
    return `${coupon.code} (−${pct}%)`;
  }
  return `${coupon.code} (−$${(coupon.amount / 100).toFixed(2)})`;
}

/**
 * Validate a coupon against the **full service subtotal** (before tax), not the deposit.
 */
export async function validateCoupon(
  db: Database,
  rawCode: string,
  fullSubtotalCents: number,
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
  if (coupon.minSubtotalCents != null && fullSubtotalCents < coupon.minSubtotalCents) {
    return { ok: false, error: "Order total is too low for this coupon" };
  }

  let discountCents = 0;
  if (coupon.type === "percent") {
    discountCents = Math.round((fullSubtotalCents * coupon.amount) / 10000);
  } else if (coupon.type === "fixed") {
    discountCents = coupon.amount;
  } else {
    return { ok: false, error: "Invalid coupon type" };
  }

  discountCents = Math.max(0, Math.min(fullSubtotalCents, discountCents));
  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      name: coupon.name,
    },
    discountCents,
  };
}

export type DiscountedCharge = {
  priceCents: number;
  depositCents: number | null;
  /** Amount charged now (pre-tax) — deposit or discounted full */
  baseCents: number;
  taxCents: number;
  totalCents: number;
  paymentMode: string;
  discountCents: number;
  /** Full price after coupon, before tax */
  discountedPriceCents: number;
  /** Remaining pre-tax balance after today's charge */
  remainingBaseCents: number;
};

/**
 * Apply coupon against the **full** price, then charge deposit or full from the
 * discounted amount. Deposit never exceeds the discounted total.
 */
export function applyDiscountToCharge(input: {
  priceCents: number;
  depositCents: number | null;
  baseCents: number;
  taxCents: number;
  totalCents: number;
  paymentMode: string;
  discountCents: number;
  hstRateBps: number;
}): DiscountedCharge {
  const discount = Math.max(0, Math.min(input.priceCents, input.discountCents));
  const discountedPriceCents = Math.max(0, input.priceCents - discount);

  let paymentMode = input.paymentMode;
  let chargeBase = 0;

  if (paymentMode === "none" || discountedPriceCents <= 0) {
    chargeBase = 0;
    paymentMode = discountedPriceCents <= 0 ? "none" : paymentMode;
  } else if (paymentMode === "deposit") {
    const deposit = Math.max(0, input.depositCents ?? 0);
    chargeBase = Math.min(deposit, discountedPriceCents);
    // If deposit covers the whole discounted total, treat as paid in full online
    if (chargeBase >= discountedPriceCents) {
      paymentMode = "full";
      chargeBase = discountedPriceCents;
    }
  } else {
    // full
    chargeBase = discountedPriceCents;
  }

  const taxCents = chargeBase > 0 ? Math.round((chargeBase * input.hstRateBps) / 10000) : 0;
  const remainingBaseCents = Math.max(0, discountedPriceCents - chargeBase);

  return {
    priceCents: input.priceCents,
    depositCents: input.depositCents,
    baseCents: chargeBase,
    taxCents,
    totalCents: chargeBase + taxCents,
    paymentMode,
    discountCents: discount,
    discountedPriceCents,
    remainingBaseCents,
  };
}
