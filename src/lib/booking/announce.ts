import type { Database } from "@/lib/db";
import { emailAppointmentBooked } from "@/lib/email/resend";
import { notifyAdmins } from "@/lib/notifications";

function whenLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startsAt);
}

export async function announceAppointmentBooked(
  db: Database,
  appointmentId: string,
) {
  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: { select: { title: true } },
      staff: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row || row.status !== "confirmed") return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const label = whenLabel(row.startsAt, tz);

  await emailAppointmentBooked({
    to: row.clientEmail,
    clientName: row.clientName,
    serviceTitle: row.service.title,
    whenLabel: label,
    staffName: row.staff?.name,
    amountChargedCents: row.amountChargedCents,
  });

  if (row.staff?.email) {
    await emailAppointmentBooked({
      to: row.staff.email,
      clientName: row.clientName,
      serviceTitle: row.service.title,
      whenLabel: label,
      staffName: row.staff.name,
      amountChargedCents: row.amountChargedCents,
      isStaff: true,
    });
  }

  await notifyAdmins(db, {
    type: "appointment_booked",
    title: "New booking confirmed",
    body: `${row.clientName} · ${row.service.title} · ${label}`,
    href: "/admin/appointments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id },
  });
}
