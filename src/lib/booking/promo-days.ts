import { couponLabel } from "@/lib/booking/coupons";
import { asWeeklyHours, formatCad, zonedParts, type WeeklyWindow } from "@/lib/booking/money";

export type PromoDayCoupon = {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: number;
};

/** serviceId → reduced base price in cents (null/omit = regular price) */
export type PromoServicePrices = Record<string, number | null | undefined>;

export type PromoDayRow = {
  id?: string;
  date: string;
  staffId: string;
  closed: boolean;
  active: boolean;
  windows: unknown;
  serviceIds: string[];
  coupon?: PromoDayCoupon | null;
  /** Per-service reduced base prices for this promo day */
  servicePrices?: PromoServicePrices;
};

export type SlotPromo = {
  promoDayId?: string;
  /** Coupon code when coupon-based; otherwise a promo-day marker */
  code: string;
  name: string;
  type: "percent" | "fixed" | "price";
  amount: number;
  label: string;
  /** Precomputed discount vs current cart when known */
  discountCents?: number;
  servicePrices?: PromoServicePrices;
};

function asWindows(value: unknown): WeeklyWindow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (w): w is WeeklyWindow =>
      !!w &&
      typeof w === "object" &&
      typeof (w as WeeklyWindow).start === "string" &&
      typeof (w as WeeklyWindow).end === "string",
  );
}

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Merge overlapping/adjacent HH:MM windows. */
export function unionWindows(windows: WeeklyWindow[]): WeeklyWindow[] {
  if (!windows.length) return [];
  const sorted = [...windows].sort((a, b) => a.start.localeCompare(b.start));
  const out: WeeklyWindow[] = [];
  for (const w of sorted) {
    const start = hmToMinutes(w.start);
    const end = hmToMinutes(w.end);
    if (end <= start) continue;
    const last = out[out.length - 1];
    if (!last) {
      out.push({ start: minutesToHm(start), end: minutesToHm(end) });
      continue;
    }
    const lastEnd = hmToMinutes(last.end);
    if (start <= lastEnd) {
      last.end = minutesToHm(Math.max(lastEnd, end));
    } else {
      out.push({ start: minutesToHm(start), end: minutesToHm(end) });
    }
  }
  return out;
}

/** True when every requested service is covered by this promo day. */
export function promoDayCoversServices(promo: PromoDayRow, serviceIds: string[]) {
  if (!promo.active || promo.closed || !serviceIds.length || !promo.serviceIds.length) return false;
  return serviceIds.every((id) => promo.serviceIds.includes(id));
}

export function promoHasDiscount(promo: PromoDayRow) {
  if (promo.coupon?.code) return true;
  const prices = promo.servicePrices || {};
  return Object.values(prices).some((p) => typeof p === "number" && p >= 0);
}

export function promoWindowsForStaffDate(
  promos: PromoDayRow[],
  dateKey: string;
  staffId: string,
  serviceIds: string[],
): WeeklyWindow[] {
  const matched = promos.filter(
    (p) => p.date === dateKey && p.staffId === staffId && promoDayCoversServices(p, serviceIds),
  );
  return unionWindows(matched.flatMap((p) => asWindows(p.windows)));
}

/**
 * Merge promo-day hours into the per-day window map used by computeAvailableSlots.
 * Promo days add (union) open windows for matching staff + services — they do not close other days.
 */
export function mergePromoDayWindows(input: {
  dayWindows: Record<string, WeeklyWindow[] | null>;
  weeklyHours: unknown;
  dayKeyByDate: Record<string, string>;
  promos: PromoDayRow[];
  staffId: string;
  serviceIds: string[];
}): Record<string, WeeklyWindow[] | null> {
  const weekly = asWeeklyHours(input.weeklyHours);
  const next: Record<string, WeeklyWindow[] | null> = { ...input.dayWindows };
  const dates = new Set<string>([
    ...Object.keys(input.dayWindows),
    ...Object.keys(input.dayKeyByDate),
    ...input.promos.filter((p) => p.staffId === input.staffId).map((p) => p.date),
  ]);

  for (const dateKey of dates) {
    const promoWindows = promoWindowsForStaffDate(
      input.promos,
      dateKey,
      input.staffId,
      input.serviceIds,
    );
    if (!promoWindows.length) continue;

    const override = Object.prototype.hasOwnProperty.call(next, dateKey)
      ? next[dateKey]
      : undefined;
    const dayKey = input.dayKeyByDate[dateKey];
    const base =
      override === undefined
        ? dayKey
          ? weekly[dayKey] || []
          : []
        : override || [];

    next[dateKey] = unionWindows([...base, ...promoWindows]);
  }

  return next;
}

/** Pick matching promo day that covers services (with coupon and/or price overrides). */
export function findMatchingPromoDay(
  promos: PromoDayRow[],
  input: { dateKey: string; staffId: string | null; serviceIds: string[] },
): PromoDayRow | null {
  if (!input.staffId) return null;
  const matched = promos.filter(
    (p) =>
      p.date === input.dateKey &&
      p.staffId === input.staffId &&
      promoDayCoversServices(p, input.serviceIds) &&
      promoHasDiscount(p),
  );
  // Prefer days with price overrides, then coupon
  matched.sort((a, b) => {
    const aPrices = Object.values(a.servicePrices || {}).some((p) => typeof p === "number");
    const bPrices = Object.values(b.servicePrices || {}).some((p) => typeof p === "number");
    if (aPrices !== bPrices) return aPrices ? -1 : 1;
    return 0;
  });
  return matched[0] || null;
}

/**
 * Discount from per-service promo base prices.
 * lines are resolved booking lines (price already qty-expanded).
 */
export function discountCentsFromServicePrices(
  lines: { serviceId: string; priceCents: number }[],
  servicePrices: PromoServicePrices | undefined,
) {
  if (!servicePrices) return 0;
  let discount = 0;
  for (const line of lines) {
    const promoPrice = servicePrices[line.serviceId];
    if (typeof promoPrice !== "number" || promoPrice < 0) continue;
    // line.priceCents may be qty * unit; scale promo price by inferring unit from... 
    // Better: treat promoPriceCents as unit price and we need quantity.
    // For simplicity store promo as total replacement for the line's service total when qty=1,
    // or as unit price. Admin UI will set unit promo price; lines from resolveBookingItems
    // multiply by quantity. So we need unit regular vs unit promo.
    // Without unit on line, approximate: if promoPrice <= line.priceCents, discount = line - promo
    // (works for qty=1). For qty>1, admin sets unit promo and we need quantity on line.
    discount += Math.max(0, line.priceCents - promoPrice);
  }
  return discount;
}

/**
 * Compute discount for a promo day: prefer per-service base prices when any are set;
 * otherwise fall back to linked coupon (percent or fixed $).
 */
export function discountForPromoDay(input: {
  promo: PromoDayRow;
  fullSubtotalCents: number;
  lines: { serviceId: string; priceCents: number; quantity?: number }[];
}): { discountCents: number; code: string; label: string; type: SlotPromo["type"] } {
  const prices = input.promo.servicePrices || {};
  const hasPrices = Object.values(prices).some((p) => typeof p === "number" && p >= 0);

  if (hasPrices) {
    let discountCents = 0;
    for (const line of input.lines) {
      const unitPromo = prices[line.serviceId];
      if (typeof unitPromo !== "number" || unitPromo < 0) continue;
      const qty = Math.max(1, line.quantity || 1);
      // line.priceCents is already qty * unit regular
      const regularUnit = Math.round(line.priceCents / qty);
      const lineDiscount = Math.max(0, regularUnit - unitPromo) * qty;
      discountCents += lineDiscount;
    }
    discountCents = Math.max(0, Math.min(input.fullSubtotalCents, discountCents));
    return {
      discountCents,
      code: input.promo.coupon?.code || "PROMO-DAY",
      label:
        discountCents > 0
          ? `Promo day pricing (−${formatCad(discountCents)})`
          : "Promo day",
      type: "price",
    };
  }

  const coupon = input.promo.coupon;
  if (coupon?.code) {
    const discountCents = discountCentsForSubtotal(input.fullSubtotalCents, coupon);
    return {
      discountCents,
      code: coupon.code,
      label: couponLabel(coupon),
      type: coupon.type === "fixed" ? "fixed" : "percent",
    };
  }

  return { discountCents: 0, code: "PROMO-DAY", label: "Promo day", type: "price" };
}

export function slotPromoFromDay(
  promo: PromoDayRow | null,
  lines?: { serviceId: string; priceCents: number; quantity?: number }[],
  fullSubtotalCents?: number,
): SlotPromo | null {
  if (!promo || !promoHasDiscount(promo)) return null;
  const priced =
    lines && fullSubtotalCents != null
      ? discountForPromoDay({ promo, fullSubtotalCents, lines })
      : null;

  if (priced) {
    return {
      promoDayId: promo.id,
      code: priced.code,
      name: priced.label,
      type: priced.type,
      amount: priced.discountCents,
      label: priced.label,
      discountCents: priced.discountCents,
      servicePrices: promo.servicePrices,
    };
  }

  if (promo.coupon?.code) {
    return {
      promoDayId: promo.id,
      code: promo.coupon.code,
      name: promo.coupon.name || promo.coupon.code,
      type: promo.coupon.type === "fixed" ? "fixed" : "percent",
      amount: promo.coupon.amount,
      label: couponLabel(promo.coupon),
      servicePrices: promo.servicePrices,
    };
  }

  return {
    promoDayId: promo.id,
    code: "PROMO-DAY",
    name: "Promo day pricing",
    type: "price",
    amount: 0,
    label: "Promo day pricing",
    servicePrices: promo.servicePrices,
  };
}

/** Discount amount for a full service subtotal given coupon type/amount. */
export function discountCentsForSubtotal(
  fullSubtotalCents: number,
  coupon: { type: string; amount: number },
) {
  let discountCents = 0;
  if (coupon.type === "percent") {
    discountCents = Math.round((fullSubtotalCents * coupon.amount) / 10000);
  } else if (coupon.type === "fixed") {
    discountCents = coupon.amount;
  }
  return Math.max(0, Math.min(fullSubtotalCents, discountCents));
}

export function dateKeyInTimezone(isoOrDate: Date | string, timeZone: string) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = zonedParts(d, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function attachPromoToSlots<T extends { start: string; staffId?: string | null }>(
  slots: T[],
  promos: PromoDayRow[],
  serviceIds: string[],
  timeZone: string,
  lines?: { serviceId: string; priceCents: number; quantity?: number }[],
  fullSubtotalCents?: number,
): (T & { promo: SlotPromo | null })[] {
  return slots.map((slot) => {
    const dateKey = dateKeyInTimezone(slot.start, timeZone);
    const match = findMatchingPromoDay(promos, {
      dateKey,
      staffId: slot.staffId ?? null,
      serviceIds,
    });
    return { ...slot, promo: slotPromoFromDay(match, lines, fullSubtotalCents) };
  });
}

export function formatPromoDiscountLabel(
  promo: { type: string; amount: number; discountCents?: number },
  fallbackDiscountCents?: number,
) {
  const discountCents = promo.discountCents ?? fallbackDiscountCents ?? 0;
  if (promo.type === "percent") {
    const pct = (promo.amount / 100).toFixed(promo.amount % 100 === 0 ? 0 : 2);
    return `${pct}% off (−${formatCad(discountCents)})`;
  }
  if (promo.type === "price") {
    return discountCents > 0 ? `promo price (−${formatCad(discountCents)})` : "promo price";
  }
  return `−${formatCad(discountCents || promo.amount)}`;
}
