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
import { formatCad, multiChargeBreakdown } from "@/lib/booking/money";
import { findBookableAddons, findBookableServices, staffForAllServices } from "@/lib/booking/service";
import { getStripe, hasStripe, siteUrl } from "@/lib/booking/stripe";
import { effectiveWeeklyHours } from "@/lib/booking/weekly-hours";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

const schema = z.object({
  categoryId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1),
  addonIds: z.array(z.string().uuid()).optional(),
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

  const services = await findBookableServices(db, parsed.data.serviceIds);
  if (!services) {
    return NextResponse.json({ error: "Services not available" }, { status: 404 });
  }

  const categoryIds = [...new Set(services.map((s) => s.categoryId))];
  if (parsed.data.categoryId && !categoryIds.includes(parsed.data.categoryId)) {
    return NextResponse.json({ error: "Category does not match selected services" }, { status: 400 });
  }

  const addons = parsed.data.addonIds?.length
    ? await findBookableAddons(db, parsed.data.addonIds, categoryIds)
    : [];
  if (addons === null) {
    return NextResponse.json({ error: "Add-ons not available for the selected services" }, { status: 404 });
  }

  const categoryId = parsed.data.categoryId || services[0].categoryId;
  const durationMinutes =
    services.reduce((sum, s) => sum + s.durationMinutes, 0) +
    addons.reduce((sum, a) => sum + a.durationMinutes, 0);
  const titles = [...services.map((s) => s.title), ...addons.map((a) => a.title)];
  const serviceLabel = titles.join(", ").slice(0, 255);

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const endsAt = addMinutes(startsAt, durationMinutes);
  const holds = activeHoldStatuses();
  const serviceIds = services.map((s) => s.id);

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

  const charge = multiChargeBreakdown([...services, ...addons], settings.hstRateBps);
  const instantlyConfirmed = charge.paymentMode === "none" || charge.totalCents <= 0;

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
      categoryId,
      serviceId: services[0].id,
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
        create: services.map((s, index) => ({
          serviceId: s.id,
          title: s.title,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          depositCents: s.depositCents,
          paymentMode: s.paymentMode,
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

  if (!hasStripe()) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  const label =
    charge.paymentMode === "deposit"
      ? `Booking deposit — ${serviceLabel}`
      : `Booking payment — ${serviceLabel}`;

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
              name: label.slice(0, 120),
              description: `${formatCad(charge.baseCents)} + HST ${formatCad(charge.taxCents)}`,
            },
          },
        },
      ],
      metadata: {
        appointmentId: appointment.id,
        categoryId,
        serviceIds: serviceIds.join(","),
        addonIds: addons.map((a) => a.id).join(","),
        paymentMode: charge.paymentMode,
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
