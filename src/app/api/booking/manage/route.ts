import { NextResponse } from "next/server";
import { addMinutes, addDays } from "date-fns";
import { z } from "zod";
import {
  announceAppointmentCancelled,
  announceAppointmentRescheduled,
} from "@/lib/booking/announce";
import { activeHoldStatuses } from "@/lib/booking/availability";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import {
  appointmentDurationMinutes,
  canSelfServeChange,
  isManageableStatus,
  SELF_SERVE_CHANGE_HOURS,
} from "@/lib/booking/manage";
import { verifyManageToken } from "@/lib/booking/manage-token";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

function whenLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startsAt);
}

async function loadManagedAppointment(token: string) {
  const payload = await verifyManageToken(token);
  if (!payload) return { error: "Invalid or expired link", status: 401 as const };

  const db = getPrisma();
  const row = await db.appointment.findUnique({
    where: { id: payload.aid },
    include: {
      service: { select: { id: true, title: true, slug: true } },
      category: { select: { id: true, title: true, slug: true } },
      staff: { select: { id: true, name: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: { serviceId: true, title: true, durationMinutes: true, variantId: true },
      },
    },
  });
  if (!row) return { error: "Appointment not found", status: 404 as const };
  return { db, row };
}

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Booking unavailable" }, { status: 503 });
  }
  const token = new URL(req.url).searchParams.get("token") || "";
  const loaded = await loadManagedAppointment(token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { row } = loaded;
  const settings = await getSettings();
  const tz = settings.timezone;
  const serviceIds = row.lines.length
    ? [...new Set(row.lines.map((l) => l.serviceId))]
    : row.serviceId
      ? [row.serviceId]
      : [];
  const items = row.lines.length
    ? row.lines.map((l) => ({
        serviceId: l.serviceId,
        variantId: l.variantId,
        quantity: 1,
      }))
    : serviceIds.map((serviceId) => ({ serviceId, quantity: 1 }));

  const canChange =
    isManageableStatus(row.status) && canSelfServeChange(row.startsAt, SELF_SERVE_CHANGE_HOURS);

  return NextResponse.json({
    appointment: {
      id: row.id,
      status: row.status,
      title: appointmentDisplayTitle(row),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      whenLabel: whenLabel(row.startsAt, tz),
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      staffName: row.staff?.name || null,
      staffId: row.staffId,
      categorySlug: row.category.slug,
      serviceIds,
      items,
      canCancel: canChange,
      canReschedule: canChange,
      minLeadHours: SELF_SERVE_CHANGE_HOURS,
      timezone: tz,
    },
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    token: z.string().min(10),
    action: z.literal("cancel"),
  }),
  z.object({
    token: z.string().min(10),
    action: z.literal("reschedule"),
    startsAt: z.string().datetime(),
  }),
]);

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Booking unavailable" }, { status: 503 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const loaded = await loadManagedAppointment(parsed.data.token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { db, row } = loaded;
  const settings = await getSettings();

  if (!isManageableStatus(row.status)) {
    return NextResponse.json(
      { error: "This appointment can no longer be changed online." },
      { status: 400 },
    );
  }

  if (!canSelfServeChange(row.startsAt, SELF_SERVE_CHANGE_HOURS)) {
    return NextResponse.json(
      {
        error: `Changes must be made at least ${SELF_SERVE_CHANGE_HOURS} hours before your appointment. Please contact the studio.`,
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "cancel") {
    if (row.status === "cancelled") {
      return NextResponse.json({ ok: true, status: "cancelled" });
    }
    await db.appointment.update({
      where: { id: row.id },
      data: { status: "cancelled" },
    });
    await announceAppointmentCancelled(db, row.id);
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  if (!canSelfServeChange(startsAt, SELF_SERVE_CHANGE_HOURS)) {
    return NextResponse.json(
      {
        error: `New time must be at least ${SELF_SERVE_CHANGE_HOURS} hours from now.`,
      },
      { status: 400 },
    );
  }

  const duration = appointmentDurationMinutes(row.startsAt, row.endsAt);
  const endsAt = addMinutes(startsAt, duration);
  const previousStartsAt = row.startsAt;

  // Conflict check — exclude this appointment
  const holds = activeHoldStatuses();
  const conflictWhere = {
    id: { not: row.id },
    status: { in: [...holds] },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
    ...(row.staffId ? { staffId: row.staffId } : {}),
  };
  const conflict = await db.appointment.findFirst({ where: conflictWhere, select: { id: true } });
  if (conflict) {
    return NextResponse.json({ error: "That time is no longer available. Pick another slot." }, { status: 409 });
  }

  const block = await db.blockedTime.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: row.staffId ? [{ staffId: null }, { staffId: row.staffId }] : [{ staffId: null }],
    },
    select: { id: true },
  });
  if (block) {
    return NextResponse.json({ error: "That time is blocked. Pick another slot." }, { status: 409 });
  }

  // Soft bound: new time should be within advance window
  const maxDate = addDays(new Date(), settings.maxAdvanceDays || 60);
  if (startsAt > maxDate) {
    return NextResponse.json({ error: "That date is too far ahead." }, { status: 400 });
  }

  await db.appointment.update({
    where: { id: row.id },
    data: {
      startsAt,
      endsAt,
      // Clear reminder so a new one can go out for the new time
      reminderSentAt: null,
    },
  });

  await announceAppointmentRescheduled(db, row.id, previousStartsAt);

  return NextResponse.json({
    ok: true,
    status: row.status,
    startsAt: startsAt.toISOString(),
    whenLabel: whenLabel(startsAt, settings.timezone),
  });
}
