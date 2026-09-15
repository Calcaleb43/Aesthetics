import { NextResponse } from "next/server";
import { addHours, subHours } from "date-fns";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { emailAppointmentReminder, emailAppointmentThankYou } from "@/lib/email/resend";
import { getPrisma, hasDatabase } from "@/lib/db";
import { notifyAdmins } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "No database" }, { status: 503 });
  }

  const db = getPrisma();
  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const now = new Date();

  const reminderWindowStart = addHours(now, 20);
  const reminderWindowEnd = addHours(now, 28);
  const thankYouWindowStart = subHours(now, 28);
  const thankYouWindowEnd = subHours(now, 20);

  const include = {
    service: { select: { title: true } },
    category: { select: { title: true, slug: true } },
    lines: { orderBy: { sortOrder: "asc" as const }, select: { title: true } },
    staff: { select: { id: true, name: true } },
  };

  const [reminders, thankYous] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: { in: ["confirmed", "pending_payment"] },
        reminderSentAt: null,
        startsAt: { gte: reminderWindowStart, lte: reminderWindowEnd },
      },
      include,
      take: 100,
    }),
    db.appointment.findMany({
      where: {
        status: { in: ["confirmed", "completed"] },
        thankYouSentAt: null,
        endsAt: { gte: thankYouWindowStart, lte: thankYouWindowEnd },
      },
      include,
      take: 100,
    }),
  ]);

  let remindersSent = 0;
  for (const row of reminders) {
    const whenLabel = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "short",
    }).format(row.startsAt);
    const serviceTitle = appointmentDisplayTitle(row);

    await emailAppointmentReminder({
      db,
      appointmentId: row.id,
      to: row.clientEmail,
      clientName: row.clientName,
      serviceTitle,
      whenLabel,
      staffName: row.staff?.name,
      categorySlug: row.category.slug,
      paymentUrl:
        row.status === "pending_payment" && row.stripeCheckoutUrl ? row.stripeCheckoutUrl : null,
    });

    await notifyAdmins(db, {
      type: "reminder_due",
      title: "Upcoming appointment",
      body: `${row.clientName} · ${serviceTitle} · ${whenLabel}`,
      includeStaffId: row.staffId,
      metadata: { appointmentId: row.id },
    });

    await db.appointment.update({
      where: { id: row.id },
      data: { reminderSentAt: new Date() },
    });
    remindersSent += 1;
  }

  let thankYousSent = 0;
  for (const row of thankYous) {
    const whenLabel = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "short",
    }).format(row.startsAt);
    const serviceTitle = appointmentDisplayTitle(row);

    await emailAppointmentThankYou({
      db,
      appointmentId: row.id,
      to: row.clientEmail,
      clientName: row.clientName,
      serviceTitle,
      whenLabel,
      staffName: row.staff?.name,
      categorySlug: row.category.slug,
    });

    await db.appointment.update({
      where: { id: row.id },
      data: { thankYouSentAt: new Date() },
    });
    thankYousSent += 1;
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    thankYousSent,
    sent: remindersSent + thankYousSent,
  });
}
