import { addDays, addMonths, addWeeks, differenceInCalendarWeeks, parseISO } from "date-fns";
import { couponLabel } from "@/lib/booking/coupons";
import { asWeeklyHours, formatCad, zonedParts, type WeeklyWindow } from "@/lib/booking/money";

export type PromoRecurrence = "none" | "weekly" | "biweekly" | "monthly";

export type PromoDayCoupon = {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: number;
};

/**
 * Price map keys:
 * - `serviceId` → base service (no variant / fallback)
 * - `serviceId:variantId` → specific variant
 */
export type PromoServicePrices = Record<string, number | null | undefined>;

export type PromoDayRow = {
  id?: string;
  /** Start date YYYY-MM-DD */
  date: string;
  /** End date YYYY-MM-DD (inclusive); defaults to date */
  endDate?: string;
  recurrence?: PromoRecurrence | string;
  staffId: string;
  closed: boolean;
  active: boolean;
  windows: unknown;
  serviceIds: string[];
  coupon?: PromoDayCoupon | null;
  servicePrices?: PromoServicePrices;
};

export type SlotPromo = {
  promoDayId?: string;
  code: string;
  name: string;
  type: "percent" | "fixed" | "price";
  amount: number;
  label: string;
  discountCents?: number;
  servicePrices?: PromoServicePrices;
};

export function promoPriceKey(serviceId: string, variantId?: string | null) {
  return variantId ? `${serviceId}:${variantId}` : serviceId;
}

export function resolvePromoUnitPrice(
  prices: PromoServicePrices | undefined,
  serviceId: string,
  variantId?: string | null,
): number | null {
  if (!prices) return null;
  if (variantId) {
    const specific = prices[promoPriceKey(serviceId, variantId)];
    if (typeof specific === "number" && specific >= 0) return specific;
  }
  const base = prices[serviceId];
  if (typeof base === "number" && base >= 0) return base;
  return null;
}

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

export function promoEndDate(promo: { date: string; endDate?: string | null }) {
  const end = (promo.endDate || "").trim();
  return end && end >= promo.date ? end : promo.date;
}

function parseDateOnly(ymd: string) {
  return parseISO(`${ymd}T12:00:00`);
}

function formatDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whether this promo rule applies on a specific calendar day. */
export function promoAppliesOnDate(
  promo: { date: string; endDate?: string | null; recurrence?: string | null; active?: boolean; closed?: boolean },
  dateKey: string,
): boolean {
  if (promo.active === false || promo.closed) return false;
  const start = promo.date;
  const end = promoEndDate(promo);
  if (dateKey < start || dateKey > end) return false;

  const recurrence = (promo.recurrence || "none") as PromoRecurrence;
  if (recurrence === "none") return true;

  const startDt = parseDateOnly(start);
  const dayDt = parseDateOnly(dateKey);

  if (recurrence === "weekly") {
    return dayDt.getDay() === startDt.getDay();
  }
  if (recurrence === "biweekly") {
    if (dayDt.getDay() !== startDt.getDay()) return false;
    const weeks = differenceInCalendarWeeks(dayDt, startDt, { weekStartsOn: 0 });
    return weeks % 2 === 0;
  }
  if (recurrence === "monthly") {
    return dayDt.getDate() === startDt.getDate();
  }
  return true;
}

/** Expand a promo rule into concrete YYYY-MM-DD dates (for duplicate / preview). */
export function expandPromoOccurrenceDates(input: {
  startDate: string;
  endDate?: string | null;
  recurrence?: string | null;
  /** Cap expanded dates (safety). */
  maxDates?: number;
}): string[] {
  const start = input.startDate;
  const end = input.endDate && input.endDate >= start ? input.endDate : start;
  const recurrence = (input.recurrence || "none") as PromoRecurrence;
  const maxDates = Math.min(Math.max(input.maxDates || 366, 1), 730);
  const out: string[] = [];

  if (recurrence === "none") {
    let cursor = parseDateOnly(start);
    const last = parseDateOnly(end);
    while (cursor <= last && out.length < maxDates) {
      out.push(formatDateOnly(cursor));
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  if (recurrence === "weekly" || recurrence === "biweekly") {
    const step = recurrence === "biweekly" ? 2 : 1;
    let cursor = parseDateOnly(start);
    const last = parseDateOnly(end);
    while (cursor <= last && out.length < maxDates) {
      out.push(formatDateOnly(cursor));
      cursor = addWeeks(cursor, step);
    }
    return out;
  }

  if (recurrence === "monthly") {
    let cursor = parseDateOnly(start);
    const last = parseDateOnly(end);
    const dom = cursor.getDate();
    while (cursor <= last && out.length < maxDates) {
      out.push(formatDateOnly(cursor));
      const next = addMonths(cursor, 1);
      // Clamp to same DOM when month is shorter
      const clamped = new Date(next.getFullYear(), next.getMonth(), Math.min(dom, 28));
      // Prefer real DOM if month has it
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      cursor = new Date(next.getFullYear(), next.getMonth(), Math.min(dom, daysInMonth), 12);
      void clamped;
    }
    return out;
  }

  return [start];
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
  dateKey: string,
  staffId: string,
  serviceIds: string[],
): WeeklyWindow[] {
  const matched = promos.filter(
    (p) =>
      p.staffId === staffId &&
      promoAppliesOnDate(p, dateKey) &&
      promoDayCoversServices(p, serviceIds),
  );
  return unionWindows(matched.flatMap((p) => asWindows(p.windows)));
}

/**
 * Merge promo-day hours into the per-day window map used by computeAvailableSlots.
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
  ]);

  // Also include dates from promo ranges that fall in the known dayKey map
  for (const dateKey of Object.keys(input.dayKeyByDate)) {
    dates.add(dateKey);
  }

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

/** Pick matching promo for a booking date + staff + services. */
export function findMatchingPromoDay(
  promos: PromoDayRow[],
  input: { dateKey: string; staffId: string | null; serviceIds: string[] },
): PromoDayRow | null {
  if (!input.staffId) return null;
  const matched = promos.filter(
    (p) =>
      p.staffId === input.staffId &&
      promoAppliesOnDate(p, input.dateKey) &&
      promoDayCoversServices(p, input.serviceIds) &&
      promoHasDiscount(p),
  );
  matched.sort((a, b) => {
    const aPrices = Object.values(a.servicePrices || {}).some((p) => typeof p === "number");
    const bPrices = Object.values(b.servicePrices || {}).some((p) => typeof p === "number");
    if (aPrices !== bPrices) return aPrices ? -1 : 1;
    return 0;
  });
  return matched[0] || null;
}

/**
 * Compute discount for a promo day: prefer per-service/variant base prices when any are set;
 * otherwise fall back to linked coupon (percent or fixed $).
 */
export function discountForPromoDay(input: {
  promo: PromoDayRow;
  fullSubtotalCents: number;
  lines: { serviceId: string; variantId?: string | null; priceCents: number; quantity?: number }[];
}): { discountCents: number; code: string; label: string; type: SlotPromo["type"] } {
  const prices = input.promo.servicePrices || {};
  const hasPrices = Object.values(prices).some((p) => typeof p === "number" && p >= 0);

  if (hasPrices) {
    let discountCents = 0;
    for (const line of input.lines) {
      const unitPromo = resolvePromoUnitPrice(prices, line.serviceId, line.variantId);
      if (unitPromo == null) continue;
      const qty = Math.max(1, line.quantity || 1);
      const regularUnit = Math.round(line.priceCents / qty);
      discountCents += Math.max(0, regularUnit - unitPromo) * qty;
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
  lines?: { serviceId: string; variantId?: string | null; priceCents: number; quantity?: number }[],
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
  lines?: { serviceId: string; variantId?: string | null; priceCents: number; quantity?: number }[],
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

export function recurrenceLabel(recurrence: string | null | undefined) {
  switch (recurrence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    default:
      return "Date range";
  }
}
