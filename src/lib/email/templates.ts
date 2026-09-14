import { formatCad } from "@/lib/booking/money";
import { siteUrl } from "@/lib/booking/stripe";
import {
  DEFAULT_STUDIO,
  emailButton,
  escapeHtml,
  renderEmailLayout,
  type StudioEmailContext,
} from "@/lib/email/layout";

export const EMAIL_TEMPLATE_KEYS = [
  "appointment_booked",
  "appointment_booked_staff",
  "appointment_cancelled",
  "appointment_reminder",
  "appointment_thank_you",
  "inquiry_received",
  "inquiry_alert",
  "test_email",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type RenderedEmail = {
  subject: string;
  html: string;
  preheader?: string;
};

export const EMAIL_TEMPLATE_META: Record<
  EmailTemplateKey,
  { label: string; description: string; audience: "client" | "staff" | "studio" }
> = {
  appointment_booked: {
    label: "Booking confirmed",
    description: "Sent to the client when an appointment is confirmed.",
    audience: "client",
  },
  appointment_booked_staff: {
    label: "New booking (staff)",
    description: "Sent to the assigned staff member on confirmation.",
    audience: "staff",
  },
  appointment_cancelled: {
    label: "Appointment cancelled",
    description: "Sent to the client when a booking is cancelled.",
    audience: "client",
  },
  appointment_reminder: {
    label: "Appointment reminder",
    description: "Sent ~24 hours before the appointment. Copy editable in Email → templates.",
    audience: "client",
  },
  appointment_thank_you: {
    label: "Thank you / review",
    description: "Sent ~24 hours after the appointment with review + rebook links. Copy editable in Email → templates.",
    audience: "client",
  },
  inquiry_received: {
    label: "Inquiry received",
    description: "Auto-reply to the client after a contact form submission.",
    audience: "client",
  },
  inquiry_alert: {
    label: "New inquiry alert",
    description: "Notifies the studio when a new inquiry arrives.",
    audience: "studio",
  },
  test_email: {
    label: "Test email",
    description: "Verifies Resend delivery from the admin email hub.",
    audience: "studio",
  },
};

export type AppointmentEmailVars = {
  studio?: StudioEmailContext;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string | null;
  serviceTitle: string;
  whenLabel: string;
  endsLabel?: string | null;
  staffName?: string | null;
  amountChargedCents?: number;
  categorySlug?: string | null;
  notes?: string | null;
  /** Optional CMS override for subject / intro (from Email templates). */
  copyOverride?: { subject?: string; introHtml?: string } | null;
};

export type InquiryEmailVars = {
  studio?: StudioEmailContext;
  name: string;
  email: string;
  phone?: string | null;
  serviceInterest?: string | null;
  message: string;
};

function studioOf(vars: { studio?: StudioEmailContext }) {
  return vars.studio || DEFAULT_STUDIO;
}

export function renderAppointmentBooked(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  const careHref = vars.categorySlug ? `${base}/care/${vars.categorySlug}` : `${base}/care`;
  const paid =
    typeof vars.amountChargedCents === "number" && vars.amountChargedCents > 0
      ? formatCad(vars.amountChargedCents)
      : null;

  return {
    subject: `Booking confirmed — ${vars.serviceTitle}`,
    preheader: `${vars.serviceTitle} on ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Confirmed",
      title: "You're booked",
      introHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your appointment is confirmed. We look forward to seeing you at the studio.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "When", value: vars.whenLabel },
        ...(vars.staffName ? [{ label: "With", value: vars.staffName }] : []),
        ...(paid ? [{ label: "Paid", value: paid }] : []),
      ],
      bodyHtml: `<p style="margin:0;">Please review policies and pre-care before your visit. Arrive on time — late arrivals may need to be shortened or rescheduled.</p>`,
      ctaHtml: [
        emailButton("Pre & aftercare", careHref),
        emailButton("Policies", `${base}/policies`, "ghost"),
        emailButton("Studio site", base, "ghost"),
      ].join(""),
    }),
  };
}

export function renderAppointmentBookedStaff(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `New booking — ${vars.serviceTitle}`,
    preheader: `${vars.clientName} · ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Studio alert",
      title: "New appointment",
      introHtml: `<p style="margin:0;">Hi ${escapeHtml(vars.staffName || "team")}, a new booking is on your calendar.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "When", value: vars.whenLabel },
        { label: "Client", value: vars.clientName },
        ...(vars.clientEmail ? [{ label: "Email", value: vars.clientEmail }] : []),
        ...(vars.clientPhone ? [{ label: "Phone", value: vars.clientPhone }] : []),
        ...(vars.notes ? [{ label: "Notes", value: vars.notes }] : []),
      ],
      ctaHtml: emailButton("Open calendar", `${base}/admin/appointments`),
    }),
  };
}

export function renderAppointmentCancelled(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `Cancelled — ${vars.serviceTitle}`,
    preheader: `Your ${vars.serviceTitle} on ${vars.whenLabel} was cancelled`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Update",
      title: "Appointment cancelled",
      introHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your appointment has been cancelled. If this was unexpected or you'd like to rebook, reply to this email or use the booking link below.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "Was scheduled", value: vars.whenLabel },
      ],
      ctaHtml: [
        emailButton("Rebook", `${base}/book-now`),
        emailButton("Contact studio", `mailto:${studio.email}`, "ghost"),
      ].join(""),
    }),
  };
}

export function renderAppointmentReminder(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  const careHref = vars.categorySlug ? `${base}/care/${vars.categorySlug}` : `${base}/care`;
  const defaultIntro = `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">This is a friendly reminder for your upcoming appointment. Please arrive on time and follow any pre-care steps for your treatment.</p>`;
  return {
    subject: vars.copyOverride?.subject || `Reminder — ${vars.serviceTitle} tomorrow`,
    preheader: `${vars.serviceTitle} on ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Reminder",
      title: "See you soon",
      introHtml: vars.copyOverride?.introHtml || defaultIntro,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "When", value: vars.whenLabel },
        ...(vars.staffName ? [{ label: "With", value: vars.staffName }] : []),
        { label: "Location", value: studio.address },
      ],
      ctaHtml: [
        emailButton("Pre-care guide", careHref),
        emailButton("Policies", `${base}/policies`, "ghost"),
      ].join(""),
    }),
  };
}

export function renderAppointmentThankYou(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  const rebookHref = `${base}/book-now`;
  const reviewUrl = (studio.googleReviewsUrl || "").trim();
  const defaultIntro = `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0 0 12px;">Thank you for visiting ${escapeHtml(studio.siteName)}. We hope you loved your experience.</p>
        <p style="margin:0;">If you have a moment, a Google review helps others find us — and we'd love to see you again whenever you're ready.</p>`;
  const ctas = [
    ...(reviewUrl ? [emailButton("Leave a Google review", reviewUrl)] : []),
    emailButton("Book again", rebookHref, reviewUrl ? "ghost" : "gold"),
  ];
  return {
    subject: vars.copyOverride?.subject || `Thank you — ${studio.siteName}`,
    preheader: reviewUrl
      ? "Thanks for visiting — leave a review or book again anytime"
      : "Thanks for visiting — book again anytime",
    html: renderEmailLayout({
      studio,
      eyebrow: "Thank you",
      title: "Grateful you chose us",
      introHtml: vars.copyOverride?.introHtml || defaultIntro,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "Visit", value: vars.whenLabel },
      ],
      ctaHtml: ctas.join(""),
    }),
  };
}

export function renderInquiryReceived(vars: InquiryEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `We received your message — ${studio.siteName}`,
    preheader: "Thanks for reaching out. We'll get back to you shortly.",
    html: renderEmailLayout({
      studio,
      eyebrow: "Contact",
      title: "Message received",
      introHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.name)},</p>
        <p style="margin:0;">Thank you for contacting ${escapeHtml(studio.siteName)}. We've received your message and will reply as soon as we can.</p>`,
      detailRows: [
        ...(vars.serviceInterest ? [{ label: "Interest", value: vars.serviceInterest }] : []),
        { label: "Your message", value: vars.message },
      ],
      ctaHtml: [
        emailButton("View services", `${base}/services`),
        emailButton("Book now", `${base}/book-now`, "ghost"),
      ].join(""),
    }),
  };
}

export function renderInquiryAlert(vars: InquiryEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `New inquiry — ${vars.name}`,
    preheader: vars.serviceInterest || vars.message.slice(0, 80),
    html: renderEmailLayout({
      studio,
      eyebrow: "Inbox",
      title: "New inquiry",
      introHtml: `<p style="margin:0;">A new contact form submission just arrived.</p>`,
      detailRows: [
        { label: "Name", value: vars.name },
        { label: "Email", value: vars.email },
        ...(vars.phone ? [{ label: "Phone", value: vars.phone }] : []),
        ...(vars.serviceInterest ? [{ label: "Interest", value: vars.serviceInterest }] : []),
        { label: "Message", value: vars.message },
      ],
      ctaHtml: emailButton("Open inquiries", `${base}/admin/inquiries`),
    }),
  };
}

export function renderTestEmail(studio?: StudioEmailContext): RenderedEmail {
  const s = studio || DEFAULT_STUDIO;
  return {
    subject: `Test email — ${s.siteName}`,
    preheader: "Resend delivery is working.",
    html: renderEmailLayout({
      studio: s,
      eyebrow: "System",
      title: "Email delivery OK",
      introHtml: `<p style="margin:0;">This is a test message from the Aniekanvas admin email hub. If you received it, Resend is configured correctly.</p>`,
      detailRows: [
        { label: "From studio", value: s.email },
        { label: "Sent at", value: new Date().toISOString() },
      ],
    }),
  };
}

export function renderEmailTemplate(
  key: EmailTemplateKey,
  vars: AppointmentEmailVars | InquiryEmailVars | { studio?: StudioEmailContext } = {},
): RenderedEmail {
  switch (key) {
    case "appointment_booked":
      return renderAppointmentBooked(vars as AppointmentEmailVars);
    case "appointment_booked_staff":
      return renderAppointmentBookedStaff(vars as AppointmentEmailVars);
    case "appointment_cancelled":
      return renderAppointmentCancelled(vars as AppointmentEmailVars);
    case "appointment_reminder":
      return renderAppointmentReminder(vars as AppointmentEmailVars);
    case "appointment_thank_you":
      return renderAppointmentThankYou(vars as AppointmentEmailVars);
    case "inquiry_received":
      return renderInquiryReceived(vars as InquiryEmailVars);
    case "inquiry_alert":
      return renderInquiryAlert(vars as InquiryEmailVars);
    case "test_email":
      return renderTestEmail((vars as { studio?: StudioEmailContext }).studio);
    default:
      return renderTestEmail();
  }
}

export function sampleVarsForTemplate(key: EmailTemplateKey): AppointmentEmailVars | InquiryEmailVars {
  const appointmentSample: AppointmentEmailVars = {
    clientName: "Alex Client",
    clientEmail: "alex@example.com",
    clientPhone: "(416) 555-0100",
    serviceTitle: "Ombré Brows",
    whenLabel: "Friday, March 20, 2026 at 2:00 p.m. EDT",
    staffName: "Anie",
    amountChargedCents: 11300,
    categorySlug: "ombre-brows",
    notes: "First visit",
  };
  const inquirySample: InquiryEmailVars = {
    name: "Alex Client",
    email: "alex@example.com",
    phone: "(416) 555-0100",
    serviceInterest: "Cold Plasma",
    message: "I'd love to learn more about treatment options for my skin.",
  };
  if (key === "inquiry_received" || key === "inquiry_alert") return inquirySample;
  return appointmentSample;
}
