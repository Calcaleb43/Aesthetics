import { NextResponse } from "next/server";
import { addDays, subMinutes } from "date-fns";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
  type BusyRange,
} from "@/lib/booking/availability";
import { findBookableServices, staffForAllServices } from "@/lib/booking/service";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

export type StaffSlot = { start: string; end: string; staffId: string | null; staffName: string | null };

function parseServiceIds(url: URL) {
  const multi = url.searchParams.getAll("serviceIds");
  const csv = url.searchParams.get("serviceIds");
  const single = url.searchParams.get("serviceId");
  const fromMulti = multi.length > 1 ? multi : csv ? csv.split(",") : multi;
  const ids = [...fromMulti, single].filter((v): v is string => !!v && v.trim().length > 0).map((v) => v.trim());
  return [...new Set(ids)];
}

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const serviceIds = parseServiceIds(url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  if (!serviceIds.length) {
    return NextResponse.json({ error: "serviceIds required" }, { status: 400 });
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

    const services = await findBookableServices(db, serviceIds);
    if (!services) {
      return NextResponse.json({ error: "Services not found or must share one category" }, { status: 404 });
    }

    const durationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const from = fromParam ? new Date(fromParam) : new Date();
    const to = toParam ? new Date(toParam) : addDays(from, 14);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const assigned = await staffForAllServices(
      db,
      services.map((s) => s.id),
    );

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
      slotIntervalMinutes: settings.slotIntervalMinutes,
      bufferMinutes: settings.bufferMinutes,
      minLeadHours: settings.minLeadHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      durationMinutes,
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
      for (const s of computeAvailableSlots({
        ...baseInput,
        weeklyHours: settings.weeklyHours,
        busy,
      })) {
        slots.push({ ...s, staffId: null, staffName: null });
      }
    } else {
      const byStart = new Map<string, StaffSlot>();
      for (const admin of assigned) {
        const [appointments, staffBlocks] = await Promise.all([
          db.appointment.findMany({
            where: {
              staffId: admin.id,
              status: { in: [...holds] },
              startsAt: { lt: to },
              endsAt: { gt: from },
            },
            select: { startsAt: true, endsAt: true },
          }),
          db.blockedTime.findMany({
            where: {
              OR: [{ staffId: null }, { staffId: admin.id }],
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
        for (const s of computeAvailableSlots({
          ...baseInput,
          weeklyHours: effectiveWeeklyHours(admin.weeklyHours, settings.weeklyHours),
          busy,
        })) {
          if (!byStart.has(s.start)) {
            byStart.set(s.start, {
              ...s,
              staffId: admin.id,
              staffName: admin.name,
            });
          }
        }
      }
      slots.push(...[...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)));
    }

    return NextResponse.json({
      serviceIds: services.map((s) => s.id),
      categoryId: services[0].categoryId,
      timezone: settings.timezone,
      durationMinutes,
      slots,
    });
  } catch (err) {
    console.error("Booking availability error", err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 503 });
  }
}
