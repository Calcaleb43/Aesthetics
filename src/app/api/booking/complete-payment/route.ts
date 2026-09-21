import { NextResponse } from "next/server";
import { addDays, addMinutes } from "date-fns";
import { z } from "zod";
import { activeHoldStatuses } from "@/lib/booking/availability";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { appointmentDurationMinutes } from "@/lib/booking/manage";
import { verifyManageToken } from "@/lib/booking/manage-token";
import { formatCad } from "@/lib/booking/money";
import {
  createBookingCheckoutSession,
  normalizePaymentProvider,
  paymentProviderConfigured,
} from "@/lib/booking/payments";
import { isAppointmentSlotAvailable } from "@/lib/booking/slot-available";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

const PAYABLE_STATUSES = ["pending_payment", "expired"] as const;

function whenLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startsAt);
}

async function loadPayableAppointment(token: string) {
  const payload = await verifyManageToken(token);
  if (!payload) return { error: "Invalid or expired link", status: 401 as const };

  const db = getPrisma();
  const row = await db.appointment.findUnique({
    where: { id: payload.aid },
    include: {
      service: { select: { id: true, title: true } },
      category: { select: { id: true, title: true, slug: true } },
      staff: { select: { id: true, name: true, weeklyHours: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          serviceId: true,
          variantId: true,
          title: true,
          durationMinutes: true,
        },
      },
      addons: { select: { addonId: true } },
    },
  });
  if (!row) return { error: "Appointment not found", status: 404 as const };
  return { db, row };
}

function isPayableStatus(status: string) {
  return (PAYABLE_STATUSES as readonly string[]).includes(status);
}

async function slotOptsFromSettings() {
  const settings = await getSettings();
  return {
    settings,
    opts: {
      timeZone: settings.timezone,
      weeklyHours: settings.weeklyHours,
      slotIntervalMinutes: settings.slotIntervalMinutes,
      bufferMinutes: settings.bufferMinutes,
      maxAdvanceDays: settings.maxAdvanceDays,
    },
  };
}

async function ensurePendingAndCheckout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
): Promise<
  | { error: string; status: number }
  | { confirmed: true; checkoutUrl: null }
  | { confirmed: false; checkoutUrl: string }
> {
  const { settings } = await slotOptsFromSettings();
  const paymentProvider = normalizePaymentProvider(settings.paymentProvider);

  if (row.status === "confirmed") {
    return { error: "This booking is already confirmed.", status: 400 };
  }
  if (!isPayableStatus(row.status)) {
    return { error: "This booking can no longer be paid online.", status: 400 };
  }

  if (row.status === "expired") {
    await db.appointment.update({
      where: { id: row.id },
      data: { status: "pending_payment", createdAt: new Date() },
    });
  }

  if (!paymentProviderConfigured(paymentProvider) || row.amountChargedCents <= 0) {
    await db.appointment.update({
      where: { id: row.id },
      data: { status: "confirmed" },
    });
    return { confirmed: true, checkoutUrl: null };
  }

  const serviceIds = row.lines.length
    ? [...new Set(row.lines.map((l: { serviceId: string }) => l.serviceId))]
    : row.serviceId
      ? [row.serviceId]
      : [];
  const serviceLabel = appointmentDisplayTitle(row);

  const session = await createBookingCheckoutSession({
    provider: paymentProvider,
    appointmentId: row.id,
    clientEmail: row.clientEmail,
    serviceLabel,
    categoryId: row.categoryId,
    serviceIds: serviceIds as string[],
    addonIds: (row.addons || []).map((a: { addonId: string }) => a.addonId),
    paymentMode: row.paymentMode,
    baseCents: Math.max(0, row.amountChargedCents - row.taxCents),
    taxCents: row.taxCents,
    totalCents: row.amountChargedCents,
  });

  await db.appointment.update({
    where: { id: row.id },
    data: {
      status: "pending_payment",
      stripeSessionId: session.externalId || null,
      stripeCheckoutUrl: session.checkoutUrl,
    },
  });

  return { confirmed: false, checkoutUrl: session.checkoutUrl };
}

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Booking unavailable" }, { status: 503 });
  }

  const token = new URL(req.url).searchParams.get("token") || "";
  const loaded = await loadPayableAppointment(token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { db, row } = loaded;
  const { settings, opts } = await slotOptsFromSettings();

  if (row.status === "confirmed") {
    return NextResponse.json({
      alreadyConfirmed: true,
      appointment: {
        id: row.id,
        status: row.status,
        title: appointmentDisplayTitle(row),
        whenLabel: whenLabel(row.startsAt, settings.timezone),
      },
    });
  }

  if (!isPayableStatus(row.status)) {
    return NextResponse.json(
      { error: "This booking can no longer be paid online." },
      { status: 400 },
    );
  }

  const slotAvailable = await isAppointmentSlotAvailable(db, row, opts);
  const serviceIds = row.lines.length
    ? [...new Set(row.lines.map((l) => l.serviceId))]
    : row.serviceId
      ? [row.serviceId]
      : [];
  const items = row.lines.length
    ? (() => {
        const byService = new Map<string, string[]>();
        for (const line of row.lines) {
          const list = byService.get(line.serviceId) || [];
          if (line.variantId) list.push(line.variantId);
          byService.set(line.serviceId, list);
        }
        return [...byService.entries()].map(([serviceId, variantIds]) => ({
          serviceId,
          variantIds,
        }));
      })()
    : serviceIds.map((serviceId) => ({ serviceId, variantIds: [] as string[] }));

  return NextResponse.json({
    alreadyConfirmed: false,
    slotAvailable,
    appointment: {
      id: row.id,
      status: row.status,
      title: appointmentDisplayTitle(row),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      whenLabel: whenLabel(row.startsAt, settings.timezone),
      clientName: row.clientName,
      amountDueCents: row.amountChargedCents,
      amountDueLabel: formatCad(row.amountChargedCents),
      staffId: row.staffId,
      staffName: row.staff?.name || null,
      serviceIds,
      items,
      timezone: settings.timezone,
    },
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    token: z.string().min(10),
    action: z.literal("pay"),
  }),
  z.object({
    token: z.string().min(10),
    action: z.literal("reschedule"),
    startsAt: z.string().datetime(),
    staffId: z.string().uuid().nullable().optional(),
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

  const loaded = await loadPayableAppointment(parsed.data.token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { db, row } = loaded;
  const { settings, opts } = await slotOptsFromSettings();

  if (row.status === "confirmed") {
    return NextResponse.json({ error: "This booking is already confirmed." }, { status: 400 });
  }
  if (!isPayableStatus(row.status)) {
    return NextResponse.json(
      { error: "This booking can no longer be paid online." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "pay") {
    const available = await isAppointmentSlotAvailable(db, row, opts);
    if (!available) {
      return NextResponse.json(
        {
          error: "That time is no longer available. Pick a new date and time to continue.",
          slotAvailable: false,
        },
        { status: 409 },
      );
    }
    try {
      const result = await ensurePendingAndCheckout(db, row);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      if (result.confirmed) {
        return NextResponse.json({ ok: true, confirmed: true, checkoutUrl: null });
      }
      return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
    } catch (err) {
      console.error("[complete-payment] checkout failed", err);
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }
  }

  // Reschedule held booking to a free slot, then checkout
  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  const duration = appointmentDurationMinutes(row.startsAt, row.endsAt);
  const endsAt = addMinutes(startsAt, duration);
  const staffId =
    parsed.data.staffId !== undefined ? parsed.data.staffId : row.staffId;

  const maxDate = addDays(new Date(), settings.maxAdvanceDays || 60);
  if (startsAt > maxDate) {
    return NextResponse.json({ error: "That date is too far ahead." }, { status: 400 });
  }
  if (startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Pick a future time." }, { status: 400 });
  }

  const holds = activeHoldStatuses();
  const conflict = await db.appointment.findFirst({
    where: {
      id: { not: row.id },
      status: { in: [...holds] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(staffId ? { staffId } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json({ error: "That time is no longer available. Pick another slot." }, { status: 409 });
  }

  const block = await db.blockedTime.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: staffId ? [{ staffId: null }, { staffId }] : [{ staffId: null }],
    },
    select: { id: true },
  });
  if (block) {
    return NextResponse.json({ error: "That time is blocked. Pick another slot." }, { status: 409 });
  }

  const updated = await db.appointment.update({
    where: { id: row.id },
    data: {
      startsAt,
      endsAt,
      staffId,
      status: "pending_payment",
      createdAt: new Date(),
      reminderSentAt: null,
    },
    include: {
      service: { select: { id: true, title: true } },
      category: { select: { id: true, title: true, slug: true } },
      staff: { select: { id: true, name: true, weeklyHours: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: { serviceId: true, variantId: true, title: true, durationMinutes: true },
      },
      addons: { select: { addonId: true } },
    },
  });

  try {
    const result = await ensurePendingAndCheckout(db, updated);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      confirmed: Boolean(result.confirmed),
      checkoutUrl: result.checkoutUrl,
      whenLabel: whenLabel(startsAt, settings.timezone),
      startsAt: startsAt.toISOString(),
    });
  } catch (err) {
    console.error("[complete-payment] reschedule checkout failed", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
