import type { Database } from "@/lib/db";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { appointmentManageUrl } from "@/lib/booking/manage-token";
import { estimateBalanceDueCents, formatCad } from "@/lib/booking/money";
import { createBalanceCheckoutSession } from "@/lib/booking/payments";
import { hasStripe } from "@/lib/booking/stripe";
import {
  emailAppointmentBooked,
  emailAppointmentCancelled,
  emailAppointmentCancelledStaff,
  emailAppointmentRescheduled,
  emailAppointmentUpdated,
} from "@/lib/email/resend";
import { loadStudioEmailContext, studioManagerEmails } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications";
import { sendSmsMany } from "@/lib/sms/twilio";

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
  staff: { select: { id: true, name: true, email: true, phone: true } },
  lines: { orderBy: { sortOrder: "asc" as const }, select: { title: true } },
};

async function studioAlertPhones(db: Database, staffPhone?: string | null) {
  const settings = await db.siteSettings.findUnique({ where: { id: 1 }, select: { phone: true } });
  const managers = await db.admin.findMany({
    where: { active: true, role: { in: ["owner", "manager"] } },
    select: { phone: true },
  });
  return [settings?.phone, staffPhone, ...managers.map((m) => m.phone)];
}

async function emailStudioStaff(
  db: Database,
  staffEmail: string | null | undefined,
  send: (to: string) => Promise<unknown>,
) {
  const managers = await studioManagerEmails(db);
  const recipients = new Set<string>();
  for (const m of managers) recipients.add(m.email.toLowerCase());
  if (staffEmail) recipients.add(staffEmail.toLowerCase());
  if (!recipients.size) {
    const studio = await loadStudioEmailContext(db);
    if (studio.email) recipients.add(studio.email.toLowerCase());
  }
  for (const to of recipients) {
    await send(to);
  }
}

export async function announceAppointmentBooked(db: Database, appointmentId: string) {
  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  if (!row || row.status !== "confirmed") return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const hstRateBps = settings?.hstRateBps ?? 1300;
  const label = whenLabel(row.startsAt, tz);
  const serviceTitle = appointmentDisplayTitle(row);
  const manageUrl = await appointmentManageUrl(row.id);
  const balanceDueCents = estimateBalanceDueCents(row, hstRateBps);

  let balancePaymentUrl: string | null = null;
  if (balanceDueCents > 0 && hasStripe()) {
    try {
      const session = await createBalanceCheckoutSession({
        appointmentId: row.id,
        clientEmail: row.clientEmail,
        serviceLabel: serviceTitle,
        balanceDueCents,
      });
      balancePaymentUrl = session.checkoutUrl;
      await db.appointment.update({
        where: { id: row.id },
        data: { stripeCheckoutUrl: session.checkoutUrl },
      });
    } catch (err) {
      console.error("[announce] balance checkout failed", err);
    }
  }

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
    balanceDueCents,
    paymentMode: row.paymentMode,
    balancePaymentUrl,
    categorySlug: row.category.slug,
    notes: row.notes || null,
    manageUrl,
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
      balanceDueCents,
      paymentMode: row.paymentMode,
      categorySlug: row.category.slug,
      notes: row.notes || null,
      isStaff: true,
    });
  }

  await notifyAdmins(db, {
    type: "appointment_booked",
    title: "New booking confirmed",
    body:
      balanceDueCents > 0
        ? `${row.clientName} · ${serviceTitle} · ${label} · balance ${formatCad(balanceDueCents)}`
        : `${row.clientName} · ${serviceTitle} · ${label}`,
    href: "/admin/appointments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id, balanceDueCents },
  });

  await sendSmsMany({
    phones: await studioAlertPhones(db, row.staff?.phone),
    body:
      balanceDueCents > 0
        ? `Aniekanvas: new booking — ${row.clientName}, ${serviceTitle}, ${label}. Balance due ${formatCad(balanceDueCents)}`
        : `Aniekanvas: new booking — ${row.clientName}, ${serviceTitle}, ${label}`,
  });
  await sendSmsMany({
    phones: [row.clientPhone],
    body:
      balanceDueCents > 0
        ? `Aniekanvas: deposit confirmed for ${serviceTitle} on ${label}. Balance due ${formatCad(balanceDueCents)}. Manage: ${manageUrl}`
        : `Aniekanvas: your ${serviceTitle} is confirmed for ${label}. Manage: ${manageUrl}`,
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
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    serviceTitle,
    whenLabel: label,
    categorySlug: row.category.slug,
  });

  await emailStudioStaff(db, row.staff?.email, (to) =>
    emailAppointmentCancelledStaff({
      db,
      appointmentId: row.id,
      to,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      serviceTitle,
      whenLabel: label,
      staffName: row.staff?.name,
      categorySlug: row.category.slug,
    }),
  );

  await notifyAdmins(db, {
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    body: `${row.clientName} · ${serviceTitle} · ${label}`,
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id },
  });

  await sendSmsMany({
    phones: await studioAlertPhones(db, row.staff?.phone),
    body: `Aniekanvas: CANCELLED — ${row.clientName}, ${serviceTitle}, was ${label}`,
  });
  await sendSmsMany({
    phones: [row.clientPhone],
    body: `Aniekanvas: your ${serviceTitle} on ${label} was cancelled. Rebook at aniekanvasaesthetics.ca/book-now`,
  });
}

export async function announceAppointmentRescheduled(
  db: Database,
  appointmentId: string,
  previousStartsAt: Date,
) {
  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  if (!row || !isStillActive(row.status)) return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const label = whenLabel(row.startsAt, tz);
  const previousLabel = whenLabel(previousStartsAt, tz);
  const serviceTitle = appointmentDisplayTitle(row);
  const manageUrl = await appointmentManageUrl(row.id);

  await emailAppointmentRescheduled({
    db,
    appointmentId: row.id,
    to: row.clientEmail,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    serviceTitle,
    whenLabel: label,
    previousWhenLabel: previousLabel,
    staffName: row.staff?.name,
    categorySlug: row.category.slug,
    manageUrl,
  });

  await emailStudioStaff(db, row.staff?.email, (to) =>
    emailAppointmentRescheduled({
      db,
      appointmentId: row.id,
      to,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      serviceTitle,
      whenLabel: label,
      previousWhenLabel: previousLabel,
      staffName: row.staff?.name,
      categorySlug: row.category.slug,
      isStaff: true,
    }),
  );

  await notifyAdmins(db, {
    type: "appointment_rescheduled",
    title: "Appointment rescheduled",
    body: `${row.clientName} · ${serviceTitle} · ${previousLabel} → ${label}`,
    href: "/admin/appointments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id },
  });

  await sendSmsMany({
    phones: await studioAlertPhones(db, row.staff?.phone),
    body: `Aniekanvas: RESCHEDULED — ${row.clientName}, ${serviceTitle}: ${previousLabel} → ${label}`,
  });
  await sendSmsMany({
    phones: [row.clientPhone],
    body: `Aniekanvas: your ${serviceTitle} moved to ${label}. Manage: ${manageUrl}`,
  });
}

export async function announceAppointmentUpdated(
  db: Database,
  appointmentId: string,
  changeLines: string[],
) {
  const lines = changeLines.map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return;

  const row = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  if (!row || !isStillActive(row.status)) return;

  const settings = await db.siteSettings.findUnique({ where: { id: 1 } });
  const tz = settings?.timezone || "America/Toronto";
  const label = whenLabel(row.startsAt, tz);
  const serviceTitle = appointmentDisplayTitle(row);
  const manageUrl = await appointmentManageUrl(row.id);
  const summary = lines.join("; ");

  await emailAppointmentUpdated({
    db,
    appointmentId: row.id,
    to: row.clientEmail,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    serviceTitle,
    whenLabel: label,
    staffName: row.staff?.name,
    categorySlug: row.category.slug,
    manageUrl,
    changeLines: lines,
  });

  await emailStudioStaff(db, row.staff?.email, (to) =>
    emailAppointmentUpdated({
      db,
      appointmentId: row.id,
      to,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      serviceTitle,
      whenLabel: label,
      staffName: row.staff?.name,
      categorySlug: row.category.slug,
      changeLines: lines,
      isStaff: true,
    }),
  );

  await notifyAdmins(db, {
    type: "appointment_updated",
    title: "Booking updated",
    body: `${row.clientName} · ${serviceTitle} · ${summary}`,
    href: "/admin/appointments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id, changeLines: lines },
  });

  await sendSmsMany({
    phones: await studioAlertPhones(db, row.staff?.phone),
    body: `Aniekanvas: UPDATED — ${row.clientName}, ${serviceTitle}: ${summary}`.slice(0, 320),
  });
  await sendSmsMany({
    phones: [row.clientPhone],
    body: `Aniekanvas: your ${serviceTitle} booking was updated (${summary}). Details: ${manageUrl}`.slice(
      0,
      320,
    ),
  });
}

function isStillActive(status: string) {
  return status === "confirmed" || status === "pending_payment";
}
