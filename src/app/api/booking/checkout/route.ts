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
import { chargeBreakdown, formatCad } from "@/lib/booking/money";
import { findBookableService } from "@/lib/booking/service";
import { getStripe, hasStripe, siteUrl } from "@/lib/booking/stripe";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

const schema = z.object({
  serviceId: z.string().min(1),
  startsAt: z.string().datetime(),
  staffId: z.string().uuid().nullable().optional(),
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
  const holds = activeHoldStatuses();

  const assigned = await db.staffService.findMany({
    where: { serviceId: service.id, admin: { active: true } },
    include: { admin: { select: { id: true, name: true, weeklyHours: true } } },
    orderBy: { admin: { name: "asc" } },
  });

  let staffId: string | null = parsed.data.staffId || null;
  if (assigned.length) {
    const candidates = staffId
      ? assigned.filter((a) => a.adminId === staffId)
      : assigned;
    let chosen: string | null = null;
    for (const row of candidates) {
      const [appointments, blocks] = await Promise.all([
        db.appointment.findMany({
          where: {
            staffId: row.adminId,
            status: { in: [...holds] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { startsAt: true, endsAt: true },
        }),
        db.blockedTime.findMany({
          where: {
            OR: [{ staffId: null }, { staffId: row.adminId }],
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { startsAt: true, endsAt: true },
        }),
      ]);
      if (!appointments.length && !blocks.length) {
        // Still verify via slot engine for lead time / hours
        const dayStart = new Date(startsAt);
        dayStart.setUTCHours(0, 0, 0, 0);
        const busy: BusyRange[] = [
          ...(
            await db.appointment.findMany({
              where: {
                staffId: row.adminId,
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
                OR: [{ staffId: null }, { staffId: row.adminId }],
                startsAt: { lt: addMinutes(dayStart, 48 * 60) },
                endsAt: { gt: dayStart },
              },
              select: { startsAt: true, endsAt: true },
            })
          ).map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
        ];
        const open = computeAvailableSlots({
          timeZone: settings.timezone,
          weeklyHours: effectiveWeeklyHours(row.admin.weeklyHours, settings.weeklyHours),
          slotIntervalMinutes: settings.slotIntervalMinutes,
          bufferMinutes: settings.bufferMinutes,
          minLeadHours: settings.minLeadHours,
          maxAdvanceDays: settings.maxAdvanceDays,
          durationMinutes: service.durationMinutes,
          from: dayStart,
          to: addMinutes(dayStart, 48 * 60),
          busy,
        });
        if (open.some((s) => s.start === startsAt.toISOString())) {
          chosen = row.adminId;
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
      durationMinutes: service.durationMinutes,
      from: dayStart,
      to: addMinutes(dayStart, 48 * 60),
      busy,
    });
    if (!open.some((s) => s.start === startsAt.toISOString())) {
      return NextResponse.json({ error: "That time is no longer available" }, { status: 409 });
    }
    staffId = null;
  }

  const charge = chargeBreakdown({
    priceCents: service.priceCents,
    depositCents: service.depositCents,
    paymentMode: service.paymentMode,
    hstRateBps: settings.hstRateBps,
  });

  const instantlyConfirmed = service.paymentMode === "none" || charge.totalCents <= 0;

  const clientName = parsed.data.clientName.trim();
  const clientEmail = parsed.data.clientEmail.trim().toLowerCase();
  const clientPhone = parsed.data.clientPhone?.trim() || null;

  const client = await upsertClient(db, {
    email: clientEmail,
    name: clientName,
    phone: clientPhone,
  });

  const appointment = await db.appointment.create({
    data: {
      serviceId: service.id,
      staffId,
      clientId: client.id,
      startsAt,
      endsAt,
      clientName,
      clientEmail,
      clientPhone,
      notes: parsed.data.notes?.trim() || "",
      status: instantlyConfirmed ? "confirmed" : "pending_payment",
      priceCents: service.priceCents,
      depositCents: service.depositCents,
      taxCents: charge.taxCents,
      amountChargedCents: charge.totalCents,
      paymentMode: service.paymentMode,
      policyAcceptedAt: new Date(),
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
