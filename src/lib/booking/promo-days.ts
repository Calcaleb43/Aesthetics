import { couponLabel } from "@/lib/booking/coupons";
import { asWeeklyHours, formatCad, zonedParts, type WeeklyWindow } from "@/lib/booking/money";

export type PromoDayCoupon = {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: number;
};

export type PromoDayRow = {
  id?: string;
  date: string;
  staffId: string;
  closed: boolean;
  active: boolean;
  windows: unknown;
  serviceIds: string[];
  coupon?: PromoDayCoupon | null;
};

export type SlotPromo = {
  promoDayId?: string;
  code: string;
  name: string;
  type: string;
  amount: number;
  label: string;
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

export function promoWindowsForStaffDate(
  promos: PromoDayRow[],
  dateKey: string,
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

/** Pick the best matching promo day (with coupon) for a booking date + staff + services. */
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
      Boolean(p.coupon?.code),
  );
  return matched[0] || null;
}

export function slotPromoFromDay(promo: PromoDayRow | null): SlotPromo | null {
  if (!promo?.coupon?.code) return null;
  return {
    promoDayId: promo.id,
    code: promo.coupon.code,
    name: promo.coupon.name || promo.coupon.code,
    type: promo.coupon.type,
    amount: promo.coupon.amount,
    label: couponLabel(promo.coupon),
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
): (T & { promo: SlotPromo | null })[] {
  return slots.map((slot) => {
    const dateKey = dateKeyInTimezone(slot.start, timeZone);
    const match = findMatchingPromoDay(promos, {
      dateKey,
      staffId: slot.staffId ?? null,
      serviceIds,
    });
    return { ...slot, promo: slotPromoFromDay(match) };
  });
}

export function formatPromoDiscountLabel(coupon: { type: string; amount: number }, discountCents: number) {
  if (coupon.type === "percent") {
    const pct = (coupon.amount / 100).toFixed(coupon.amount % 100 === 0 ? 0 : 2);
    return `${pct}% off (−${formatCad(discountCents)})`;
  }
  return `−${formatCad(discountCents)}`;
}
