import { NextResponse } from "next/server";
import { addDays, endOfMonth, startOfMonth, subMinutes } from "date-fns";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
  type BusyRange,
} from "@/lib/booking/availability";
import {
  pickOverridesForStaff,
  windowsForDate,
  type DayOverrideRow,
} from "@/lib/booking/day-overrides";
import { mergePromoDayWindows, attachPromoToSlots, type PromoDayRow } from "@/lib/booking/promo-days";
import {
  findBookableAddons,
  normalizeBookingItems,
  resolveBookingItems,
  staffForAllServices,
  type BookingItemInput,
} from "@/lib/booking/service";
import { dayKeyFromWeekday, zonedParts, type WeeklyWindow } from "@/lib/booking/money";
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

function parseAddonIds(url: URL) {
  const multi = url.searchParams.getAll("addonIds");
  const csv = url.searchParams.get("addonIds");
  const fromMulti = multi.length > 1 ? multi : csv ? csv.split(",") : multi;
  return [...new Set(fromMulti.filter((v): v is string => !!v && v.trim().length > 0).map((v) => v.trim()))];
}

function parseItems(url: URL): BookingItemInput[] | null {
  const raw = url.searchParams.get("items");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as BookingItemInput[];
      return normalizeBookingItems({ items: parsed });
    } catch {
      return null;
    }
  }
  return normalizeBookingItems({ serviceIds: parseServiceIds(url) });
}

function dateKeyFromParts(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function buildDayWindows(input: {
  from: Date;
  to: Date;
  timeZone: string;
  weeklyHours: unknown;
  overrides: DayOverrideRow[];
  staffId: string | null;
}): {
  dayWindows: Record<string, WeeklyWindow[] | null>;
  dayKeyByDate: Record<string, string>;
} {
  const dayWindows: Record<string, WeeklyWindow[] | null> = {};
  const dayKeyByDate: Record<string, string> = {};
  let cursor = new Date(input.from);
  cursor.setUTCHours(12, 0, 0, 0);
  const end = new Date(input.to);
  end.setUTCHours(12, 0, 0, 0);
  while (cursor <= end) {
    const parts = zonedParts(cursor, input.timeZone);
    const dateKey = dateKeyFromParts(parts);
    const dayKey = dayKeyFromWeekday(parts.weekday);
    dayKeyByDate[dateKey] = dayKey;
    const { staffOverride, studioOverride } = pickOverridesForStaff(
      input.overrides,
      dateKey,
      input.staffId,
    );
    const windows = windowsForDate({
      dateKey,
      dayKey,
      weeklyHours: input.weeklyHours,
      studioOverride,
      staffOverride,
    });
    if (staffOverride || studioOverride) {
      dayWindows[dateKey] = windows;
    }
    cursor = addDays(cursor, 1);
  }
  return { dayWindows, dayKeyByDate };
}

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const items = parseItems(url);
  const addonIds = parseAddonIds(url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const staffIdParam = url.searchParams.get("staffId");
  const datesOnly = url.searchParams.get("datesOnly") === "1";
  const monthParam = url.searchParams.get("month"); // YYYY-MM
  const excludeAppointmentId = url.searchParams.get("excludeAppointmentId");

  if (!items?.length) {
    return NextResponse.json({ error: "serviceIds or items required" }, { status: 400 });
  }

  try {
    const db = getPrisma();
    const settings = await getSettings();
    if (!settings.bookingEnabled) {
      return NextResponse.json({ slots: [], availableDates: [], staff: [] });
    }

    await db.appointment.updateMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: subMinutes(new Date(), PENDING_HOLD_MINUTES) },
      },
      data: { status: "expired" },
    });

    const lines = await resolveBookingItems(db, items);
    if (!lines) {
      return NextResponse.json({ error: "Services or variants not available" }, { status: 404 });
    }

    const serviceIds = [...new Set(lines.map((l) => l.serviceId))];
    const categoryIds = [...new Set(lines.map((l) => l.categoryId))];
    const addons = addonIds.length ? await findBookableAddons(db, addonIds, categoryIds) : [];
    if (addons === null) {
      return NextResponse.json({ error: "Add-ons not available for the selected services" }, { status: 404 });
    }

    const durationMinutes =
      lines.reduce((sum, l) => sum + l.durationMinutes, 0) +
      addons.reduce((sum, a) => sum + a.durationMinutes, 0);

    let from: Date;
    let to: Date;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      from = startOfMonth(new Date(Date.UTC(y, m - 1, 1, 12)));
      to = endOfMonth(from);
      to = addDays(to, 1);
    } else {
      from = fromParam ? new Date(fromParam) : new Date();
      to = toParam ? new Date(toParam) : addDays(from, 14);
    }
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const assigned = await staffForAllServices(db, serviceIds);
    const staffOptions = assigned.map((a) => ({ id: a.id, name: a.name }));

    const preferredStaffId =
      staffIdParam && assigned.some((a) => a.id === staffIdParam) ? staffIdParam : null;

    const overrideRows = await db.dayOverride.findMany({
      where: {
        date: {
          gte: dateKeyFromParts(zonedParts(from, settings.timezone)),
          lte: dateKeyFromParts(zonedParts(addDays(to, -1), settings.timezone)),
        },
        OR: preferredStaffId
          ? [{ staffId: null }, { staffId: preferredStaffId }]
          : [{ staffId: null }, { staffId: { in: assigned.map((a) => a.id) } }],
      },
    });
    const overrides: DayOverrideRow[] = overrideRows.map((r) => ({
      date: r.date,
      staffId: r.staffId,
      closed: r.closed,
      windows: r.windows,
    }));

    const promoStaffFilter =
      preferredStaffId != null
        ? preferredStaffId
        : assigned.length
          ? { in: assigned.map((a) => a.id) }
          : undefined;

    const promoRows = promoStaffFilter
      ? await db.promoDay.findMany({
          where: {
            active: true,
            closed: false,
            date: {
              gte: dateKeyFromParts(zonedParts(from, settings.timezone)),
              lte: dateKeyFromParts(zonedParts(addDays(to, -1), settings.timezone)),
            },
            staffId: promoStaffFilter,
            services: { some: { serviceId: { in: serviceIds } } },
          },
          include: {
            services: { select: { serviceId: true, promoPriceCents: true } },
            coupon: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                amount: true,
                active: true,
                startsAt: true,
                endsAt: true,
                maxRedemptions: true,
                redeemedCount: true,
              },
            },
          },
        })
      : [];
    const now = new Date();
    const promoDays: PromoDayRow[] = promoRows.map((r) => {
      const coupon =
        r.coupon &&
        r.coupon.active &&
        !(r.coupon.startsAt && r.coupon.startsAt > now) &&
        !(r.coupon.endsAt && r.coupon.endsAt < now) &&
        !(r.coupon.maxRedemptions != null && r.coupon.redeemedCount >= r.coupon.maxRedemptions)
          ? {
              id: r.coupon.id,
              code: r.coupon.code,
              name: r.coupon.name,
              type: r.coupon.type,
              amount: r.coupon.amount,
            }
          : null;
      return {
        id: r.id,
        date: r.date,
        staffId: r.staffId,
        closed: r.closed,
        active: r.active,
        windows: r.windows,
        serviceIds: r.services.map((s) => s.serviceId),
        servicePrices: Object.fromEntries(
          r.services.map((s) => [s.serviceId, s.promoPriceCents]),
        ),
        coupon,
      };
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
      slotIntervalMinutes: settings.slotIntervalMinutes,
      bufferMinutes: settings.bufferMinutes,
      minLeadHours: settings.minLeadHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      durationMinutes,
      from,
      to,
    };

    const slots: StaffSlot[] = [];
    const staffPool =
      preferredStaffId && assigned.length
        ? assigned.filter((a) => a.id === preferredStaffId)
        : assigned;

    if (!staffPool.length && !assigned.length) {
      const appointments = await db.appointment.findMany({
        where: {
          status: { in: [...holds] },
          startsAt: { lt: to },
          endsAt: { gt: from },
          ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        },
        select: { startsAt: true, endsAt: true },
      });
      const busy: BusyRange[] = [
        ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
        ...studioBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
      ];
      const dayWindows = buildDayWindows({
        from,
        to,
        timeZone: settings.timezone,
        weeklyHours: settings.weeklyHours,
        overrides,
        staffId: null,
      }).dayWindows;
      for (const s of computeAvailableSlots({
        ...baseInput,
        weeklyHours: settings.weeklyHours,
        busy,
        dayWindows,
      })) {
        slots.push({ ...s, staffId: null, staffName: null });
      }
    } else {
      const pool = staffPool.length ? staffPool : assigned;
      const byStart = new Map<string, StaffSlot>();
      for (const admin of pool) {
        const [appointments, staffBlocks] = await Promise.all([
          db.appointment.findMany({
            where: {
              staffId: admin.id,
              status: { in: [...holds] },
              startsAt: { lt: to },
              endsAt: { gt: from },
              ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
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
        const weekly = effectiveWeeklyHours(admin.weeklyHours, settings.weeklyHours);
        const built = buildDayWindows({
          from,
          to,
          timeZone: settings.timezone,
          weeklyHours: weekly,
          overrides,
          staffId: admin.id,
        });
        const dayWindows = mergePromoDayWindows({
          dayWindows: built.dayWindows,
          weeklyHours: weekly,
          dayKeyByDate: built.dayKeyByDate,
          promos: promoDays,
          staffId: admin.id,
          serviceIds,
        });
        for (const s of computeAvailableSlots({
          ...baseInput,
          weeklyHours: weekly,
          busy,
          dayWindows,
        })) {
          if (preferredStaffId) {
            slots.push({ ...s, staffId: admin.id, staffName: admin.name });
          } else if (!byStart.has(s.start)) {
            byStart.set(s.start, {
              ...s,
              staffId: admin.id,
              staffName: admin.name,
            });
          }
        }
      }
      if (!preferredStaffId) {
        slots.push(...[...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)));
      } else {
        slots.sort((a, b) => a.start.localeCompare(b.start));
      }
    }

    const availableDates = [
      ...new Set(
        slots.map((s) => {
          const parts = zonedParts(new Date(s.start), settings.timezone);
          return dateKeyFromParts(parts);
        }),
      ),
    ].sort();

    const slotsWithPromo = attachPromoToSlots(
      slots,
      promoDays,
      serviceIds,
      settings.timezone,
      lines.map((l) => ({
        serviceId: l.serviceId,
        priceCents: l.priceCents,
        quantity: l.quantity,
      })),
      lines.reduce((sum, l) => sum + l.priceCents, 0) +
        addons.reduce((sum, a) => sum + a.priceCents, 0),
    );

    if (datesOnly) {
      return NextResponse.json({
        serviceIds,
        items,
        addonIds: addons.map((a) => a.id),
        categoryIds,
        timezone: settings.timezone,
        durationMinutes,
        availableDates,
        staff: staffOptions,
        slots: [],
      });
    }

    return NextResponse.json({
      serviceIds,
      items,
      addonIds: addons.map((a) => a.id),
      categoryIds,
      timezone: settings.timezone,
      durationMinutes,
      availableDates,
      staff: staffOptions,
      slots: slotsWithPromo,
    });
  } catch (err) {
    console.error("Booking availability error", err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 503 });
  }
}
