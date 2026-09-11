export type WeeklyWindow = { start: string; end: string };
export type WeeklyHours = Record<string, WeeklyWindow[]>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

/** Convert stored cents → dollars for admin forms (e.g. 8500 → 85). */
export function centsToDollars(cents: number | null | undefined) {
  if (cents == null || Number.isNaN(cents)) return null;
  return Math.round(cents) / 100;
}

/** Convert dollars from admin forms → cents (e.g. 85 or 85.50 → 8500 / 8550). */
export function dollarsToCents(dollars: number | null | undefined) {
  if (dollars == null || Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

export function taxOn(amountCents: number, hstRateBps: number) {
  return Math.round((amountCents * hstRateBps) / 10000);
}

export function chargeBreakdown(input: {
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  hstRateBps: number;
}) {
  const base =
    input.paymentMode === "full"
      ? input.priceCents
      : input.paymentMode === "deposit"
        ? Math.max(0, input.depositCents ?? 0)
        : 0;
  const taxCents = input.paymentMode === "none" ? 0 : taxOn(base, input.hstRateBps);
  return {
    baseCents: base,
    taxCents,
    totalCents: base + taxCents,
  };
}

/** Local calendar parts in a timezone */
export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday || ""] ?? 0,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Build a UTC Date that represents local wall time in `timeZone` */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = zonedParts(guess, timeZone);
  const asUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess.getTime() + (desiredMs - asUtcMs));
}

export function parseHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export function dayKeyFromWeekday(weekday: number) {
  return DAY_KEYS[weekday];
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function asWeeklyHours(value: unknown): WeeklyHours {
  if (!value || typeof value !== "object") return {};
  const out: WeeklyHours = {};
  for (const [key, windows] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(windows)) continue;
    out[key] = windows
      .filter(
        (w): w is WeeklyWindow =>
          !!w &&
          typeof w === "object" &&
          typeof (w as WeeklyWindow).start === "string" &&
          typeof (w as WeeklyWindow).end === "string",
      )
      .map((w) => ({ start: w.start, end: w.end }));
  }
  return out;
}

export function bookingHref(bookingEnabled: boolean, bookingUrl: string, categorySlug?: string | null) {
  if (bookingEnabled) {
    return categorySlug ? `/book-now?category=${encodeURIComponent(categorySlug)}` : "/book-now";
  }
  return bookingUrl;
}

/** Sum per-line charges (deposit/full/none each) into one checkout total. */
export function multiChargeBreakdown(
  lines: { priceCents: number; depositCents: number | null; paymentMode: string }[],
  hstRateBps: number,
) {
  let baseCents = 0;
  let taxCents = 0;
  let priceCents = 0;
  let depositCents = 0;
  const modes = new Set(lines.map((l) => l.paymentMode));
  for (const line of lines) {
    priceCents += line.priceCents;
    depositCents += Math.max(0, line.depositCents ?? 0);
    const part = chargeBreakdown({
      priceCents: line.priceCents,
      depositCents: line.depositCents,
      paymentMode: line.paymentMode,
      hstRateBps,
    });
    baseCents += part.baseCents;
    taxCents += part.taxCents;
  }
  const paymentMode =
    modes.size === 1
      ? [...modes][0]
      : baseCents <= 0
        ? "none"
        : depositCents > 0 && baseCents < priceCents
          ? "deposit"
          : "full";
  return {
    baseCents,
    taxCents,
    totalCents: baseCents + taxCents,
    priceCents,
    depositCents: depositCents > 0 ? depositCents : null,
    paymentMode,
  };
}
