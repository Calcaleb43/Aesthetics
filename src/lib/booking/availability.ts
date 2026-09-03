import { addDays, addMinutes, isBefore } from "date-fns";
import {
  asWeeklyHours,
  dayKeyFromWeekday,
  parseHm,
  rangesOverlap,
  zonedLocalToUtc,
  zonedParts,
  type WeeklyHours,
} from "./money";

export type BusyRange = { startsAt: Date; endsAt: Date };

export type AvailabilityInput = {
  timeZone: string;
  weeklyHours: WeeklyHours | unknown;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  durationMinutes: number;
  from: Date;
  to: Date;
  busy: BusyRange[];
  now?: Date;
};

export type Slot = { start: string; end: string };

function expandDaySlots(
  year: number,
  month: number,
  day: number,
  windows: { start: string; end: string }[],
  timeZone: string,
  durationMinutes: number,
  slotIntervalMinutes: number,
  bufferMinutes: number,
  busy: BusyRange[],
  earliest: Date,
): Slot[] {
  const slots: Slot[] = [];
  const block = durationMinutes + bufferMinutes;

  for (const window of windows) {
    const startHm = parseHm(window.start);
    const endHm = parseHm(window.end);
    let cursor = zonedLocalToUtc(year, month, day, startHm.hour, startHm.minute, timeZone);
    const windowEnd = zonedLocalToUtc(year, month, day, endHm.hour, endHm.minute, timeZone);

    while (true) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      const occupiedUntil = addMinutes(cursor, block);
      if (occupiedUntil > windowEnd) break;

      const free =
        !isBefore(cursor, earliest) &&
        !busy.some((b) =>
          rangesOverlap(cursor, occupiedUntil, b.startsAt, addMinutes(b.endsAt, bufferMinutes)),
        );

      if (free) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }

      cursor = addMinutes(cursor, slotIntervalMinutes);
      if (cursor >= windowEnd) break;
    }
  }

  return slots;
}

export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const weekly = asWeeklyHours(input.weeklyHours);
  const now = input.now ?? new Date();
  const earliest = addMinutes(now, input.minLeadHours * 60);
  const maxDate = addDays(now, input.maxAdvanceDays);

  const rangeStart = input.from < earliest ? earliest : input.from;
  const rangeEnd = input.to > maxDate ? maxDate : input.to;
  if (rangeStart >= rangeEnd) return [];

  const slots: Slot[] = [];
  // Iterate calendar days in studio TZ by walking UTC noon anchors
  let dayCursor = new Date(rangeStart);
  dayCursor.setUTCHours(12, 0, 0, 0);
  const endAnchor = new Date(rangeEnd);
  endAnchor.setUTCHours(12, 0, 0, 0);

  while (dayCursor <= endAnchor) {
    const parts = zonedParts(dayCursor, input.timeZone);
    const key = dayKeyFromWeekday(parts.weekday);
    const windows = weekly[key] || [];
    if (windows.length) {
      slots.push(
        ...expandDaySlots(
          parts.year,
          parts.month,
          parts.day,
          windows,
          input.timeZone,
          input.durationMinutes,
          input.slotIntervalMinutes,
          input.bufferMinutes,
          input.busy,
          earliest,
        ),
      );
    }
    dayCursor = addDays(dayCursor, 1);
  }

  return slots.filter((s) => {
    const start = new Date(s.start);
    return start >= rangeStart && start < rangeEnd;
  });
}

export const PENDING_HOLD_MINUTES = 30;

export function activeHoldStatuses() {
  return ["pending_payment", "confirmed"] as const;
}
