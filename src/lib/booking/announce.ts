import type { Database } from "@/lib/db";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import {
  emailAppointmentBooked,
  emailAppointmentCancelled,
} from "@/lib/email/resend";
import { notifyAdmins } from "@/lib/notifications";

function whenLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startsAt);
}

const appointmentInclude = {
  service: { select: { title: true } },
  category: { select: { title: true, slug: true } },
  staff: { select: { id: true, name: true, email: true } },
  lines: { orderBy: { sortOrder: "asc" as const }, select: { title: true } },
};

export async function announceAppointmentBooked(db: Database, appointmentId: string) {
  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  if (!row || row.status !== "confirmed") return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const label = whenLabel(row.startsAt, tz);
  const serviceTitle = appointmentDisplayTitle(row);

  await emailAppointmentBooked({
    db,
    appointmentId: row.id,
    to: row.clientEmail,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    serviceTitle,
    whenLabel: label,
    staffName: row.staff?.name,
    amountChargedCents: row.amountChargedCents,
    categorySlug: row.category.slug,
    notes: row.notes || null,
  });

  if (row.staff?.email) {
    await emailAppointmentBooked({
      db,
      appointmentId: row.id,
      to: row.staff.email,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      serviceTitle,
      whenLabel: label,
      staffName: row.staff.name,
      amountChargedCents: row.amountChargedCents,
      categorySlug: row.category.slug,
      notes: row.notes || null,
      isStaff: true,
    });
  }

  await notifyAdmins(db, {
    type: "appointment_booked",
    title: "New booking confirmed",
    body: `${row.clientName} · ${serviceTitle} · ${label}`,
    href: "/admin/appointments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id },
  });
}

export async function announceAppointmentCancelled(db: Database, appointmentId: string) {
  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  if (!row) return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const label = whenLabel(row.startsAt, tz);
  const serviceTitle = appointmentDisplayTitle(row);

  await emailAppointmentCancelled({
    db,
    appointmentId: row.id,
    to: row.clientEmail,
    clientName: row.clientName,
    serviceTitle,
    whenLabel: label,
    categorySlug: row.category.slug,
  });

  await notifyAdmins(db, {
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    body: `${row.clientName} · ${serviceTitle} · ${label}`,
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id },
  });
}
