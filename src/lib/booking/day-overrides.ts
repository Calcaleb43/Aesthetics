import { asWeeklyHours, type WeeklyHours, type WeeklyWindow } from "@/lib/booking/money";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";

export type DayOverrideRow = {
  date: string;
  staffId: string | null;
  closed: boolean;
  windows: unknown;
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

/** Resolve open windows for a YYYY-MM-DD date given weekly hours + overrides. */
export function windowsForDate(input: {
  dateKey: string;
  dayKey: string;
  weeklyHours: WeeklyHours | unknown;
  /** Studio-wide override for this date (staffId null). */
  studioOverride?: DayOverrideRow | null;
  /** Staff-specific override for this date. */
  staffOverride?: DayOverrideRow | null;
}): WeeklyWindow[] | null {
  const staff = input.staffOverride;
  if (staff) {
    if (staff.closed) return null;
    const windows = asWindows(staff.windows);
    return windows.length ? windows : null;
  }

  const studio = input.studioOverride;
  if (studio) {
    if (studio.closed) return null;
    const windows = asWindows(studio.windows);
    return windows.length ? windows : null;
  }

  const weekly = asWeeklyHours(input.weeklyHours);
  const windows = weekly[input.dayKey] || [];
  return windows.length ? windows : null;
}

export function pickOverridesForStaff(
  overrides: DayOverrideRow[],
  dateKey: string,
  staffId: string | null,
) {
  const forDate = overrides.filter((o) => o.date === dateKey);
  const staffOverride = staffId
    ? forDate.find((o) => o.staffId === staffId) || null
    : null;
  const studioOverride = forDate.find((o) => o.staffId == null) || null;
  return { staffOverride, studioOverride };
}

export function effectiveHoursWithOverrides(input: {
  staffWeeklyHours: unknown;
  studioWeeklyHours: WeeklyHours | unknown;
  dateKey: string;
  dayKey: string;
  overrides: DayOverrideRow[];
  staffId: string | null;
}): WeeklyWindow[] | null {
  const base = effectiveWeeklyHours(input.staffWeeklyHours, input.studioWeeklyHours);
  const { staffOverride, studioOverride } = pickOverridesForStaff(
    input.overrides,
    input.dateKey,
    input.staffId,
  );
  return windowsForDate({
    dateKey: input.dateKey,
    dayKey: input.dayKey,
    weeklyHours: base,
    studioOverride,
    staffOverride,
  });
}
