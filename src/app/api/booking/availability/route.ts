import { NextResponse } from "next/server";
import { addDays, subMinutes } from "date-fns";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
} from "@/lib/booking/availability";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Booking requires a database connection" }, { status: 503 });
  }

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 });
  }

  const db = getPrisma();
  const settings = await getSettings();
  if (!settings.bookingEnabled) {
    return NextResponse.json({ slots: [] });
  }

  // Expire stale payment holds
  await db.appointment.updateMany({
    where: {
      status: "pending_payment",
      createdAt: { lt: subMinutes(new Date(), PENDING_HOLD_MINUTES) },
    },
    data: { status: "expired" },
  });

  const service = await db.service.findFirst({
    where: { id: serviceId, status: "published", bookable: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const from = fromParam ? new Date(fromParam) : new Date();
  const to = toParam ? new Date(toParam) : addDays(from, 14);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const holds = activeHoldStatuses();
  const [appointments, blocks] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: { in: [...holds] },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.blockedTime.findMany({
      where: {
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const busy = [
    ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    ...blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
  ];

  const slots = computeAvailableSlots({
    timeZone: settings.timezone,
    weeklyHours: settings.weeklyHours,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bufferMinutes: settings.bufferMinutes,
    minLeadHours: settings.minLeadHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    durationMinutes: service.durationMinutes,
    from,
    to,
    busy,
  });

  return NextResponse.json({
    serviceId: service.id,
    timezone: settings.timezone,
    durationMinutes: service.durationMinutes,
    slots,
  });
}
