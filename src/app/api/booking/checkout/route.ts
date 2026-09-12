import { NextResponse } from "next/server";
import { addMinutes, subMinutes } from "date-fns";
import { z } from "zod";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
  type BusyRange,
} from "@/lib/booking/availability";
import { announceAppointmentBooked } from "@/lib/booking/announce";
import { upsertClient } from "@/lib/booking/clients";
import { multiChargeBreakdown } from "@/lib/booking/money";
import {
  findBookableAddons,
  normalizeBookingItems,
  resolveBookingItems,
  staffForAllServices,
} from "@/lib/booking/service";
import { createBookingCheckoutSession, normalizePaymentProvider, paymentProviderConfigured } from "@/lib/booking/payments";
import { siteUrl } from "@/lib/booking/stripe";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

const itemSchema = z.object({
  serviceId: z.string().uuid(),
  variantIds: z.array(z.string().uuid()).optional(),
});

const schema = z
  .object({
    categoryId: z.string().uuid().optional(),
    items: z.array(itemSchema).min(1).optional(),
    serviceIds: z.array(z.string().uuid()).min(1).optional(),
    addonIds: z.array(z.string().uuid()).optional(),
    startsAt: z.string().datetime(),
    staffId: z.string().uuid().nullable().optional(),
  clientName: z.string().min(1).max(160),
  clientEmail: z.string().email().max(255),
  clientPhone: z.string().min(1).max(64),
    notes: z.string().max(2000).optional().nullable(),
    policyAccepted: z.literal(true),
  })
  .refine((v) => (v.items?.length || 0) > 0 || (v.serviceIds?.length || 0) > 0, {
    message: "items or serviceIds required",
  });

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });
  }

  const db = getPrisma();
  const settings = await getSettings();
  if (!settings.bookingEnabled) {
    return NextResponse.json({ error: "Online booking is currently disabled" }, { status: 403 });
  }

  await db.appointment.updateMany({
    where: {
      status: "pending_payment",
      createdAt: { lt: subMinutes(new Date(), PENDING_HOLD_MINUTES) },
    },
    data: { status: "expired" },
  });

  const bookingItems = normalizeBookingItems({
    items: parsed.data.items,
    serviceIds: parsed.data.serviceIds,
  });
  if (!bookingItems) {
    return NextResponse.json({ error: "Services not available" }, { status: 404 });
  }

  const lines = await resolveBookingItems(db, bookingItems);
  if (!lines) {
    return NextResponse.json({ error: "Services or variants not available" }, { status: 404 });
  }

  const categoryIds = [...new Set(lines.map((l) => l.categoryId))];
  if (parsed.data.categoryId && !categoryIds.includes(parsed.data.categoryId)) {
    return NextResponse.json({ error: "Category does not match selected services" }, { status: 400 });
  }

  const addons = parsed.data.addonIds?.length
    ? await findBookableAddons(db, parsed.data.addonIds, categoryIds)
    : [];
  if (addons === null) {
    return NextResponse.json({ error: "Add-ons not available for the selected services" }, { status: 404 });
  }

  const categoryId = parsed.data.categoryId || lines[0].categoryId;
  const durationMinutes =
    lines.reduce((sum, l) => sum + l.durationMinutes, 0) +
    addons.reduce((sum, a) => sum + a.durationMinutes, 0);
  const titles = [...lines.map((l) => l.title), ...addons.map((a) => a.title)];
  const serviceLabel = titles.join(", ").slice(0, 255);

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const endsAt = addMinutes(startsAt, durationMinutes);
  const holds = activeHoldStatuses();
  const serviceIds = [...new Set(lines.map((l) => l.serviceId))];

  const assigned = await staffForAllServices(db, serviceIds);

  let staffId: string | null = parsed.data.staffId || null;
  if (assigned.length) {
    const candidates = staffId ? assigned.filter((a) => a.id === staffId) : assigned;
    let chosen: string | null = null;
    for (const admin of candidates) {
      const [appointments, blocks] = await Promise.all([
        db.appointment.findMany({
          where: {
            staffId: admin.id,
            status: { in: [...holds] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { startsAt: true, endsAt: true },
        }),
        db.blockedTime.findMany({
          where: {
            OR: [{ staffId: null }, { staffId: admin.id }],
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { startsAt: true, endsAt: true },
        }),
      ]);
      if (!appointments.length && !blocks.length) {
        const dayStart = new Date(startsAt);
        dayStart.setUTCHours(0, 0, 0, 0);
        const busy: BusyRange[] = [
          ...(
            await db.appointment.findMany({
              where: {
                staffId: admin.id,
                status: { in: [...holds] },
                startsAt: { lt: addMinutes(dayStart, 48 * 60) },
                endsAt: { gt: dayStart },
              },
              select: { startsAt: true, endsAt: true },
            })
          ).map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
          ...(
            await db.blockedTime.findMany({
              where: {
                OR: [{ staffId: null }, { staffId: admin.id }],
                startsAt: { lt: addMinutes(dayStart, 48 * 60) },
                endsAt: { gt: dayStart },
              },
              select: { startsAt: true, endsAt: true },
            })
          ).map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
        ];
        const open = computeAvailableSlots({
          timeZone: settings.timezone,
          weeklyHours: effectiveWeeklyHours(admin.weeklyHours, settings.weeklyHours),
          slotIntervalMinutes: settings.slotIntervalMinutes,
          bufferMinutes: settings.bufferMinutes,
          minLeadHours: settings.minLeadHours,
          maxAdvanceDays: settings.maxAdvanceDays,
          durationMinutes,
          from: dayStart,
          to: addMinutes(dayStart, 48 * 60),
          busy,
        });
        if (open.some((s) => s.start === startsAt.toISOString())) {
          chosen = admin.id;
          break;
        }
      }
    }
    if (!chosen) {
      return NextResponse.json({ error: "That time is no longer available" }, { status: 409 });
    }
    staffId = chosen;
  } else {
    const [appointments, blocks] = await Promise.all([
      db.appointment.findMany({
        where: {
          status: { in: [...holds] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { startsAt: true, endsAt: true },
      }),
      db.blockedTime.findMany({
        where: {
          staffId: null,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);
    const dayStart = new Date(startsAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const busy: BusyRange[] = [
      ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
      ...blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
    ];
    const open = computeAvailableSlots({
      timeZone: settings.timezone,
      weeklyHours: settings.weeklyHours,
      slotIntervalMinutes: settings.slotIntervalMinutes,
      bufferMinutes: settings.bufferMinutes,
      minLeadHours: settings.minLeadHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      durationMinutes,
      from: dayStart,
      to: addMinutes(dayStart, 48 * 60),
      busy,
    });
    if (!open.some((s) => s.start === startsAt.toISOString())) {
      return NextResponse.json({ error: "That time is no longer available" }, { status: 409 });
    }
    staffId = null;
  }

  const charge = multiChargeBreakdown([...lines, ...addons], settings.hstRateBps);
  const paymentProvider = normalizePaymentProvider(settings.paymentProvider);
  const instantlyConfirmed =
    paymentProvider === "none" || charge.paymentMode === "none" || charge.totalCents <= 0;

  const clientName = parsed.data.clientName.trim();
  const clientEmail = parsed.data.clientEmail.trim().toLowerCase();
  const clientPhone = parsed.data.clientPhone.trim();
  if (!clientPhone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  const client = await upsertClient(db, {
    email: clientEmail,
    name: clientName,
    phone: clientPhone,
  });

  const appointment = await db.appointment.create({
    data: {
      categoryId,
      serviceId: serviceIds[0],
      staffId,
      clientId: client.id,
      startsAt,
      endsAt,
      clientName,
      clientEmail,
      clientPhone,
      notes: parsed.data.notes?.trim() || "",
      status: instantlyConfirmed ? "confirmed" : "pending_payment",
      priceCents: charge.priceCents,
      depositCents: charge.depositCents,
      taxCents: charge.taxCents,
      amountChargedCents: charge.totalCents,
      paymentMode: charge.paymentMode,
      serviceLabel,
      policyAcceptedAt: new Date(),
      lines: {
        create: lines.map((l, index) => ({
          serviceId: l.serviceId,
          variantId: l.variantId,
          title: l.title,
          durationMinutes: l.durationMinutes,
          priceCents: l.priceCents,
          depositCents: l.depositCents,
          paymentMode: l.paymentMode,
          sortOrder: index,
        })),
      },
      addons: {
        create: addons.map((a, index) => ({
          addonId: a.id,
          title: a.title,
          durationMinutes: a.durationMinutes,
          priceCents: a.priceCents,
          depositCents: a.depositCents,
          paymentMode: a.paymentMode,
          sortOrder: index,
        })),
      },
    },
  });

  if (instantlyConfirmed) {
    await announceAppointmentBooked(db, appointment.id);
    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      checkoutUrl: `${siteUrl()}/book-now/success?appointment=${appointment.id}`,
    });
  }

  if (!paymentProviderConfigured(paymentProvider)) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });
    return NextResponse.json(
      { error: "Payments are not configured yet (set provider env keys or choose None in Settings)" },
      { status: 503 },
    );
  }

  try {
    const session = await createBookingCheckoutSession({
      provider: paymentProvider,
      appointmentId: appointment.id,
      clientEmail: appointment.clientEmail,
      serviceLabel,
      categoryId,
      serviceIds,
      addonIds: addons.map((a) => a.id),
      paymentMode: charge.paymentMode,
      baseCents: charge.baseCents,
      taxCents: charge.taxCents,
      totalCents: charge.totalCents,
    });

    await db.appointment.update({
      where: { id: appointment.id },
      data: { stripeSessionId: session.externalId || null },
    });

    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (err) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });
    console.error(err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
