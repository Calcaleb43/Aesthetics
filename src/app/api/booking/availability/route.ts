import { NextResponse } from "next/server";
import { addDays, subMinutes } from "date-fns";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
  type BusyRange,
} from "@/lib/booking/availability";
import { findBookableService } from "@/lib/booking/service";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

export type StaffSlot = { start: string; end: string; staffId: string | null; staffName: string | null };

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 });
  }

  try {
    const db = getPrisma();
    const settings = await getSettings();
    if (!settings.bookingEnabled) {
      return NextResponse.json({ slots: [] });
    }

    await db.appointment.updateMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: subMinutes(new Date(), PENDING_HOLD_MINUTES) },
      },
      data: { status: "expired" },
    });

    const service = await findBookableService(db, serviceId);
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const from = fromParam ? new Date(fromParam) : new Date();
    const to = toParam ? new Date(toParam) : addDays(from, 14);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const assigned = await db.staffService.findMany({
      where: { serviceId: service.id, admin: { active: true } },
      include: { admin: { select: { id: true, name: true } } },
      orderBy: { admin: { name: "asc" } },
    });

    const holds = activeHoldStatuses();
    const studioBlocks = await db.blockedTime.findMany({
      where: {
        staffId: null,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    });

    const baseInput = {
      timeZone: settings.timezone,
      weeklyHours: settings.weeklyHours,
      slotIntervalMinutes: settings.slotIntervalMinutes,
      bufferMinutes: settings.bufferMinutes,
      minLeadHours: settings.minLeadHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      durationMinutes: service.durationMinutes,
      from,
      to,
    };

    const slots: StaffSlot[] = [];

    if (!assigned.length) {
      const appointments = await db.appointment.findMany({
        where: {
          status: { in: [...holds] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { startsAt: true, endsAt: true },
      });
      const busy: BusyRange[] = [
        ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
        ...studioBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
      ];
      for (const s of computeAvailableSlots({ ...baseInput, busy })) {
        slots.push({ ...s, staffId: null, staffName: null });
      }
    } else {
      const byStart = new Map<string, StaffSlot>();
      for (const row of assigned) {
        const [appointments, staffBlocks] = await Promise.all([
          db.appointment.findMany({
            where: {
              staffId: row.adminId,
              status: { in: [...holds] },
              startsAt: { lt: to },
              endsAt: { gt: from },
            },
            select: { startsAt: true, endsAt: true },
          }),
          db.blockedTime.findMany({
            where: {
              OR: [{ staffId: null }, { staffId: row.adminId }],
              startsAt: { lt: to },
              endsAt: { gt: from },
            },
            select: { startsAt: true, endsAt: true },
          }),
        ]);
        const busy: BusyRange[] = [
          ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
          ...staffBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
        ];
        for (const s of computeAvailableSlots({ ...baseInput, busy })) {
          if (!byStart.has(s.start)) {
            byStart.set(s.start, {
              ...s,
              staffId: row.adminId,
              staffName: row.admin.name,
            });
          }
        }
      }
      slots.push(...[...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)));
    }

    return NextResponse.json({
      serviceId: service.id,
      timezone: settings.timezone,
      durationMinutes: service.durationMinutes,
      slots,
    });
  } catch (err) {
    console.error("Booking availability error", err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 503 });
  }
}
