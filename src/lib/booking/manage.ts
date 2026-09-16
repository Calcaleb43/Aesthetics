import { addHours, differenceInMinutes } from "date-fns";
import type { Database } from "@/lib/db";
import { activeHoldStatuses } from "@/lib/booking/availability";

export const MANAGEABLE_STATUSES = ["confirmed", "pending_payment"] as const;

/** Clients may cancel/reschedule only when the visit is at least this far away. */
export const SELF_SERVE_CHANGE_HOURS = 48;

export function isManageableStatus(status: string) {
  return (MANAGEABLE_STATUSES as readonly string[]).includes(status);
}

/** Client cancel/reschedule blocked inside the self-serve lead window (default 48h). */
export function canSelfServeChange(
  startsAt: Date,
  leadHours: number = SELF_SERVE_CHANGE_HOURS,
  now = new Date(),
) {
  const cutoff = addHours(now, Math.max(0, leadHours));
  return startsAt.getTime() >= cutoff.getTime();
}

export function appointmentDurationMinutes(startsAt: Date, endsAt: Date) {
  return Math.max(15, differenceInMinutes(endsAt, startsAt) || 60);
}

export async function loadBusyExcludingAppointment(
  db: Database,
  input: {
    from: Date;
    to: Date;
    staffId: string | null;
    excludeAppointmentId: string;
  },
) {
  const holds = activeHoldStatuses();
  const appointments = await db.appointment.findMany({
    where: {
      id: { not: input.excludeAppointmentId },
      status: { in: [...holds] },
      startsAt: { lt: input.to },
      endsAt: { gt: input.from },
      ...(input.staffId ? { staffId: input.staffId } : {}),
    },
    select: { startsAt: true, endsAt: true },
  });
  const blocks = await db.blockedTime.findMany({
    where: {
      startsAt: { lt: input.to },
      endsAt: { gt: input.from },
      OR: input.staffId
        ? [{ staffId: null }, { staffId: input.staffId }]
        : [{ staffId: null }],
    },
    select: { startsAt: true, endsAt: true },
  });
  return [
    ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    ...blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
  ];
}
