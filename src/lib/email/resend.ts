import type { Database } from "@/lib/db";
import { siteUrl } from "@/lib/booking/stripe";
import { loadTemplateCopyOverride } from "@/lib/email/overrides";
import { loadStudioEmailContext, sendEmail, studioManagerEmails } from "@/lib/email/send";
import {
  renderAppointmentBooked,
  renderAppointmentBookedStaff,
  renderAppointmentCancelled,
  renderAppointmentCancelledStaff,
  renderAppointmentReminder,
  renderAppointmentRescheduled,
  renderAppointmentRescheduledStaff,
  renderAppointmentThankYou,
  renderAppointmentUpdated,
  renderInquiryAlert,
  renderInquiryReceived,
  renderTestEmail,
  type AppointmentEmailVars,
  type InquiryEmailVars,
} from "@/lib/email/templates";
import type { TemplateVars } from "@/lib/email/custom";

function appointmentTemplateVars(input: AppointmentEmailVars, studio: NonNullable<AppointmentEmailVars["studio"]>): TemplateVars {
  const base = siteUrl();
  return {
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
  };
}

function inquiryTemplateVars(input: InquiryEmailVars, studio: NonNullable<InquiryEmailVars["studio"]>): TemplateVars {
  const base = siteUrl();
  return {
    name: input.name,
    email: input.email,
    phone: input.phone || "",
    siteName: studio.siteName,
    studioEmail: studio.email,
    studioPhone: studio.phone,
    address: studio.address,
    bookingUrl: studio.bookingUrl || `${base}/book-now`,
    siteUrl: base,
    reviewsUrl: studio.googleReviewsUrl || "",
    serviceTitle: input.serviceInterest || "",
    whenLabel: "",
    staffName: "",
    message: input.message,
  };
}

async function withAppointmentCopy(
  db: Database | null | undefined,
  slug: string,
  input: AppointmentEmailVars,
) {
  const studio = input.studio || (await loadStudioEmailContext(db));
  const copyOverride = await loadTemplateCopyOverride(db, slug, appointmentTemplateVars(input, studio));
  return { ...input, studio, copyOverride };
}

async function withInquiryCopy(
  db: Database | null | undefined,
  slug: string,
  input: InquiryEmailVars,
) {
  const studio = input.studio || (await loadStudioEmailContext(db));
  const copyOverride = await loadTemplateCopyOverride(db, slug, inquiryTemplateVars(input, studio));
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
  const slug = input.isStaff ? "appointment_booked_staff" : "appointment_booked";
  const vars = await withAppointmentCopy(input.db, slug, input);
  const rendered = input.isStaff ? renderAppointmentBookedStaff(vars) : renderAppointmentBooked(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.isStaff ? input.staffName : input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: slug,
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
  const vars = await withAppointmentCopy(input.db, "appointment_cancelled", input);
  const rendered = renderAppointmentCancelled(vars);
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

export async function emailAppointmentCancelledStaff(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
  },
) {
  const vars = await withAppointmentCopy(input.db, "appointment_cancelled_staff", input);
  const rendered = renderAppointmentCancelledStaff(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.staffName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: "appointment_cancelled_staff",
    appointmentId: input.appointmentId,
  });
}

export async function emailAppointmentRescheduled(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
    isStaff?: boolean;
  },
) {
  const slug = input.isStaff ? "appointment_rescheduled_staff" : "appointment_rescheduled";
  const vars = await withAppointmentCopy(input.db, slug, input);
  const rendered = input.isStaff
    ? renderAppointmentRescheduledStaff(vars)
    : renderAppointmentRescheduled(vars);
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.isStaff ? input.staffName : input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: slug,
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

export async function emailAppointmentUpdated(
  input: AppointmentEmailVars & {
    to: string;
    appointmentId?: string | null;
    db?: Database | null;
    isStaff?: boolean;
  },
) {
  const slug = input.isStaff ? "appointment_updated_staff" : "appointment_updated";
  const vars = await withAppointmentCopy(input.db, slug, input);
  const rendered = renderAppointmentUpdated({ ...vars, isStaff: input.isStaff });
  return sendEmail({
    db: input.db,
    to: input.to,
    toName: input.isStaff ? input.staffName : input.clientName,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: slug,
    appointmentId: input.appointmentId,
    metadata: { changeLines: input.changeLines || [] },
  });
}

export async function emailInquiryReceived(
  input: InquiryEmailVars & { inquiryId?: string | null; db?: Database | null },
) {
  const vars = await withInquiryCopy(input.db, "inquiry_received", input);
  const rendered = renderInquiryReceived(vars);
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
  const vars = await withInquiryCopy(input.db, "inquiry_alert", input);
  const rendered = renderInquiryAlert(vars);
  const managers = input.db ? await studioManagerEmails(input.db) : [];
  const recipients = managers.map((m) => m.email);
  if (!recipients.length) recipients.push(vars.studio!.email);

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
  const base = siteUrl();
  const copyOverride = await loadTemplateCopyOverride(input.db, "test_email", {
    name: "Admin",
    email: input.to,
    siteName: studio.siteName,
    studioEmail: studio.email,
    studioPhone: studio.phone,
    address: studio.address,
    bookingUrl: studio.bookingUrl || `${base}/book-now`,
    siteUrl: base,
    reviewsUrl: studio.googleReviewsUrl || "",
  });
  const rendered = renderTestEmail({ studio, copyOverride });
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
