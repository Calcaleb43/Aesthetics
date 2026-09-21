import { addDays, addMinutes } from "date-fns";
import type { Database } from "@/lib/db";
import { activeHoldStatuses, computeAvailableSlots, type BusyRange } from "@/lib/booking/availability";
import { appointmentDurationMinutes } from "@/lib/booking/manage";
import { zonedLocalToUtc, zonedParts } from "@/lib/booking/money";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";

type AppointmentForSlot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  staffId: string | null;
};

/**
 * Whether this appointment's start is still bookable (excluding the appointment itself).
 * Used by the pay-to-confirm gate so taken slots force a new time before Stripe.
 */
export async function isAppointmentSlotAvailable(
  db: Database,
  appointment: AppointmentForSlot,
  opts: {
    timeZone: string;
    weeklyHours: unknown;
    slotIntervalMinutes: number;
    bufferMinutes: number;
    maxAdvanceDays: number;
  },
): Promise<boolean> {
  const startsAt = appointment.startsAt;
  const endsAt = appointment.endsAt;
  const durationMinutes = appointmentDurationMinutes(startsAt, endsAt);
  const holds = activeHoldStatuses();

  const conflict = await db.appointment.findFirst({
    where: {
      id: { not: appointment.id },
      status: { in: [...holds] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(appointment.staffId ? { staffId: appointment.staffId } : {}),
    },
    select: { id: true },
  });
  if (conflict) return false;

  const block = await db.blockedTime.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: appointment.staffId
        ? [{ staffId: null }, { staffId: appointment.staffId }]
        : [{ staffId: null }],
    },
    select: { id: true },
  });
  if (block) return false;

  const parts = zonedParts(startsAt, opts.timeZone);
  const dayStart = zonedLocalToUtc(parts.year, parts.month, parts.day, 0, 0, opts.timeZone);
  const noon = zonedLocalToUtc(parts.year, parts.month, parts.day, 12, 0, opts.timeZone);
  const nextDayParts = zonedParts(addDays(noon, 1), opts.timeZone);
  const dayEnd = zonedLocalToUtc(nextDayParts.year, nextDayParts.month, nextDayParts.day, 0, 0, opts.timeZone);

  const [appointments, blocks, staff] = await Promise.all([
    db.appointment.findMany({
      where: {
        id: { not: appointment.id },
        status: { in: [...holds] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        ...(appointment.staffId ? { staffId: appointment.staffId } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.blockedTime.findMany({
      where: {
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        OR: appointment.staffId
          ? [{ staffId: null }, { staffId: appointment.staffId }]
          : [{ staffId: null }],
      },
      select: { startsAt: true, endsAt: true },
    }),
    appointment.staffId
      ? db.admin.findUnique({
          where: { id: appointment.staffId },
          select: { weeklyHours: true },
        })
      : Promise.resolve(null),
  ]);

  const busy: BusyRange[] = [
    ...appointments.map((a: { startsAt: Date; endsAt: Date }) => ({
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    })),
    ...blocks.map((b: { startsAt: Date; endsAt: Date }) => ({
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    })),
  ];

  const weeklyHours = appointment.staffId
    ? effectiveWeeklyHours(staff?.weeklyHours, opts.weeklyHours)
    : opts.weeklyHours;

  const open = computeAvailableSlots({
    timeZone: opts.timeZone,
    weeklyHours,
    slotIntervalMinutes: opts.slotIntervalMinutes,
    bufferMinutes: opts.bufferMinutes,
    minLeadHours: 0,
    maxAdvanceDays: opts.maxAdvanceDays,
    durationMinutes,
    from: dayStart,
    to: dayEnd,
    busy,
    // Treat the held start as still reachable even if lead time would otherwise exclude it.
    now: addMinutes(startsAt, -1),
  });

  return open.some((s) => s.start === startsAt.toISOString());
}
