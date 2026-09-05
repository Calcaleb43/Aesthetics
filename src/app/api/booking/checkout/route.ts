import { NextResponse } from "next/server";
import { addMinutes, subMinutes } from "date-fns";
import { z } from "zod";
import {
  activeHoldStatuses,
  computeAvailableSlots,
  PENDING_HOLD_MINUTES,
} from "@/lib/booking/availability";
import { chargeBreakdown, formatCad } from "@/lib/booking/money";
import { findBookableService } from "@/lib/booking/service";
import { getStripe, hasStripe, siteUrl } from "@/lib/booking/stripe";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

const schema = z.object({
  serviceId: z.string().min(1),
  startsAt: z.string().datetime(),
  clientName: z.string().min(1).max(160),
  clientEmail: z.string().email().max(255),
  clientPhone: z.string().max(64).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  policyAccepted: z.literal(true),
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

  const service = await findBookableService(db, parsed.data.serviceId);
  if (!service) {
    return NextResponse.json({ error: "Service not available" }, { status: 404 });
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const endsAt = addMinutes(startsAt, service.durationMinutes);

  const rangeFrom = addMinutes(startsAt, -settings.bufferMinutes);
  const rangeTo = addMinutes(endsAt, settings.bufferMinutes);
  const holds = activeHoldStatuses();

  const [appointments, blocks] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: { in: [...holds] },
        startsAt: { lt: rangeTo },
        endsAt: { gt: rangeFrom },
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.blockedTime.findMany({
      where: {
        startsAt: { lt: rangeTo },
        endsAt: { gt: rangeFrom },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const busy = [
    ...appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    ...blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
  ];

  const dayStart = new Date(startsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = addMinutes(dayStart, 48 * 60);
  const open = computeAvailableSlots({
    timeZone: settings.timezone,
    weeklyHours: settings.weeklyHours,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bufferMinutes: settings.bufferMinutes,
    minLeadHours: settings.minLeadHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    durationMinutes: service.durationMinutes,
    from: dayStart,
    to: dayEnd,
    busy,
  });

  if (!open.some((s) => s.start === startsAt.toISOString())) {
    return NextResponse.json({ error: "That time is no longer available" }, { status: 409 });
  }

  const charge = chargeBreakdown({
    priceCents: service.priceCents,
    depositCents: service.depositCents,
    paymentMode: service.paymentMode,
    hstRateBps: settings.hstRateBps,
  });

  const appointment = await db.appointment.create({
    data: {
      serviceId: service.id,
      startsAt,
      endsAt,
      clientName: parsed.data.clientName.trim(),
      clientEmail: parsed.data.clientEmail.trim().toLowerCase(),
      clientPhone: parsed.data.clientPhone?.trim() || null,
      notes: parsed.data.notes?.trim() || "",
      status: service.paymentMode === "none" || charge.totalCents <= 0 ? "confirmed" : "pending_payment",
      priceCents: service.priceCents,
      depositCents: service.depositCents,
      taxCents: charge.taxCents,
      amountChargedCents: charge.totalCents,
      paymentMode: service.paymentMode,
      policyAcceptedAt: new Date(),
    },
  });

  if (service.paymentMode === "none" || charge.totalCents <= 0) {
    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      checkoutUrl: `${siteUrl()}/book-now/success?appointment=${appointment.id}`,
    });
  }

  if (!hasStripe()) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  const label =
    service.paymentMode === "deposit"
      ? `Booking deposit — ${service.title}`
      : `Booking payment — ${service.title}`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: appointment.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: charge.totalCents,
            product_data: {
              name: label,
              description: `${formatCad(charge.baseCents)} + HST ${formatCad(charge.taxCents)}`,
            },
          },
        },
      ],
      metadata: {
        appointmentId: appointment.id,
        serviceId: service.id,
        paymentMode: service.paymentMode,
      },
      success_url: `${siteUrl()}/book-now/success?appointment=${appointment.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/book-now/cancelled?appointment=${appointment.id}`,
    });

    await db.appointment.update({
      where: { id: appointment.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      checkoutUrl: session.url,
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
