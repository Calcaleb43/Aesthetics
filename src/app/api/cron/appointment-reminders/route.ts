import { NextResponse } from "next/server";
import { addHours } from "date-fns";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { emailAppointmentReminder } from "@/lib/email/resend";
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
  const windowStart = addHours(now, 20);
  const windowEnd = addHours(now, 28);

  const rows = await db.appointment.findMany({
    where: {
      status: "confirmed",
      reminderSentAt: null,
      startsAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      service: { select: { title: true } },
      category: { select: { title: true } },
      lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
      staff: { select: { id: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const row of rows) {
    const whenLabel = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "short",
    }).format(row.startsAt);
    const serviceTitle = appointmentDisplayTitle(row);

    await emailAppointmentReminder({
      to: row.clientEmail,
      clientName: row.clientName,
      serviceTitle,
      whenLabel,
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
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
