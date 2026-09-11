import { z } from "zod";
import { asWeeklyHours, type WeeklyHours, type WeeklyWindow } from "./money";

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const weeklyWindowSchema = z.object({
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/),
});

export const weeklyHoursSchema = z.record(z.string(), z.array(weeklyWindowSchema));

/** null / empty object means inherit studio hours */
export function normalizeStaffWeeklyHours(value: unknown): WeeklyHours | null {
  if (value === null || value === undefined) return null;
  const hours = asWeeklyHours(value);
  const hasWindows = Object.values(hours).some((w) => w.length > 0);
  return hasWindows ? hours : null;
}

export function effectiveWeeklyHours(
  staffHours: unknown,
  studioHours: WeeklyHours | unknown,
): WeeklyHours {
  return normalizeStaffWeeklyHours(staffHours) ?? asWeeklyHours(studioHours);
}

export function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Closed minute ranges within [gridStartMin, gridEndMin) for a day key */
export function closedRangesForDay(
  weeklyHours: WeeklyHours | unknown,
  dayKey: string,
  gridStartMin: number,
  gridEndMin: number,
): { startMin: number; endMin: number }[] {
  const windows = (asWeeklyHours(weeklyHours)[dayKey] || [])
    .map((w) => ({
      start: Math.max(gridStartMin, hmToMinutes(w.start)),
      end: Math.min(gridEndMin, hmToMinutes(w.end)),
    }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  if (!windows.length) {
    return [{ startMin: gridStartMin, endMin: gridEndMin }];
  }

  const closed: { startMin: number; endMin: number }[] = [];
  let cursor = gridStartMin;
  for (const w of windows) {
    if (w.start > cursor) closed.push({ startMin: cursor, endMin: w.start });
    cursor = Math.max(cursor, w.end);
  }
  if (cursor < gridEndMin) closed.push({ startMin: cursor, endMin: gridEndMin });
  return closed;
}

/** Visible hour bounds from weekly hours, clamped */
export function gridHourBounds(
  weeklyHoursList: (WeeklyHours | unknown)[],
  clampStart = 6,
  clampEnd = 22,
): { hourStart: number; hourEnd: number } {
  let min = clampEnd * 60;
  let max = clampStart * 60;
  let any = false;

  for (const weekly of weeklyHoursList) {
    for (const windows of Object.values(asWeeklyHours(weekly))) {
      for (const w of windows as WeeklyWindow[]) {
        any = true;
        min = Math.min(min, hmToMinutes(w.start));
        max = Math.max(max, hmToMinutes(w.end));
      }
    }
  }

  if (!any) {
    return { hourStart: Math.max(clampStart, 8), hourEnd: Math.min(clampEnd, 20) };
  }

  const hourStart = Math.max(clampStart, Math.floor(min / 60));
  const hourEnd = Math.min(clampEnd, Math.ceil(max / 60));
  return {
    hourStart,
    hourEnd: Math.max(hourStart + 1, hourEnd),
  };
}
