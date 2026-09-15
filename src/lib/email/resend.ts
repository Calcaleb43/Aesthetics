import type { Database } from "@/lib/db";
import { siteUrl } from "@/lib/booking/stripe";
import { loadTemplateCopyOverride } from "@/lib/email/overrides";
import { loadStudioEmailContext, sendEmail, studioManagerEmails } from "@/lib/email/send";
import {
  renderAppointmentBooked,
  renderAppointmentBookedStaff,
  renderAppointmentCancelled,
  renderAppointmentReminder,
  renderAppointmentThankYou,
  renderInquiryAlert,
  renderInquiryReceived,
  renderTestEmail,
  type AppointmentEmailVars,
  type InquiryEmailVars,
} from "@/lib/email/templates";

async function withAppointmentCopy(
  db: Database | null | undefined,
  slug: string,
  input: AppointmentEmailVars,
) {
  const studio = input.studio || (await loadStudioEmailContext(db));
  const base = siteUrl();
  const copyOverride = await loadTemplateCopyOverride(db, slug, {
    name: input.clientName,
    email: input.clientEmail || "",
    phone: input.clientPhone || "",
    siteName: studio.siteName,
    studioEmail: studio.email,
    studioPhone: studio.phone,
    address: studio.address,
    bookingUrl: studio.bookingUrl || `${base}/book-now`,
    siteUrl: base,
    reviewsUrl: studio.googleReviewsUrl || "",
    serviceTitle: input.serviceTitle,
    whenLabel: input.whenLabel,
    staffName: input.staffName || "",
  });
  return { ...input, studio, copyOverride };
}

export async function emailAppointmentBooked(
  input: AppointmentEmailVars & {
    to: string;
    isStaff?: boolean;
    appointmentId?: string | null;
    db?: Database | null;
  },
) {
  const studio = input.studio || (await loadStudioEmailContext(input.db));
  const vars = { ...input, studio };
  const rendered = input.isStaff ? renderAppointmentBookedStaff(vars) : renderAppointmentBooked(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.isStaff ? input.staffName : input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: input.isStaff ? "appointment_booked_staff" : "appointment_booked",
    appointmentId: input.appointmentId,
    metadata: { isStaff: Boolean(input.isStaff), hasPaymentLink: Boolean(input.paymentUrl) },
  });
}

export async function emailAppointmentCancelled(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
  },
) {
  const studio = input.studio || (await loadStudioEmailContext(input.db));
  const rendered = renderAppointmentCancelled({ ...input, studio });
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "appointment_cancelled",
    appointmentId: input.appointmentId,
  });
}

export async function emailAppointmentReminder(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
  },
) {
  const vars = await withAppointmentCopy(input.db, "appointment_reminder", input);
  const rendered = renderAppointmentReminder(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "appointment_reminder",
    appointmentId: input.appointmentId,
  });
}

export async function emailAppointmentThankYou(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
  },
) {
  const vars = await withAppointmentCopy(input.db, "appointment_thank_you", input);
  const rendered = renderAppointmentThankYou(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "appointment_thank_you",
    appointmentId: input.appointmentId,
  });
}

export async function emailInquiryReceived(
  input: InquiryEmailVars & { inquiryId?: string | null; db?: Database | null },
) {
  const studio = input.studio || (await loadStudioEmailContext(input.db));
  const rendered = renderInquiryReceived({ ...input, studio });
  return sendEmail({
    db: input.db,
    to: input.email,
    toName: input.name,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "inquiry_received",
    inquiryId: input.inquiryId,
  });
}

export async function emailInquiryAlert(
  input: InquiryEmailVars & { inquiryId?: string | null; db?: Database | null },
) {
  const studio = input.studio || (await loadStudioEmailContext(input.db));
  const rendered = renderInquiryAlert({ ...input, studio });
  const managers = input.db ? await studioManagerEmails(input.db) : [];
  const recipients = managers.map((m) => m.email);
  if (!recipients.length) recipients.push(studio.email);

  const results = [];
  for (const to of recipients) {
    results.push(
      await sendEmail({
        db: input.db,
        to,
        subject: rendered.subject,
        html: rendered.html,
        templateKey: "inquiry_alert",
        inquiryId: input.inquiryId,
        replyTo: input.email,
        metadata: { clientEmail: input.email },
      }),
    );
  }
  return results;
}

export async function emailTestMessage(input: {
  to: string;
  db?: Database | null;
}) {
  const studio = await loadStudioEmailContext(input.db);
  const rendered = renderTestEmail(studio);
  return sendEmail({
    db: input.db,
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "test_email",
  });
}

/** @deprecated import path kept for older callers — prefer transactional helpers above */
export { sendEmail } from "@/lib/email/send";
