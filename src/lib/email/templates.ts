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
  "appointment_cancelled_staff",
  "appointment_rescheduled",
  "appointment_rescheduled_staff",
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
  appointment_cancelled_staff: {
    label: "Cancellation alert (studio)",
    description: "Notifies studio/staff when a booking is cancelled.",
    audience: "staff",
  },
  appointment_rescheduled: {
    label: "Appointment rescheduled",
    description: "Sent to the client when a booking time changes.",
    audience: "client",
  },
  appointment_rescheduled_staff: {
    label: "Reschedule alert (studio)",
    description: "Notifies studio/staff when a booking is rescheduled.",
    audience: "staff",
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
  /** Previous time, for reschedule notices */
  previousWhenLabel?: string | null;
  endsLabel?: string | null;
  staffName?: string | null;
  amountChargedCents?: number;
  /** Remaining studio balance after a deposit (incl. tax estimate) */
  balanceDueCents?: number;
  paymentMode?: string | null;
  /** Stripe Checkout URL to pay remaining balance */
  balancePaymentUrl?: string | null;
  categorySlug?: string | null;
  notes?: string | null;
  /** Optional CMS override for subject / intro (from Email templates). */
  copyOverride?: { subject?: string; introHtml?: string } | null;
  /** Stripe Checkout URL when payment is still owed. */
  paymentUrl?: string | null;
  /** Client self-serve cancel / reschedule link */
  manageUrl?: string | null;
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
  const balanceDue =
    typeof vars.balanceDueCents === "number" && vars.balanceDueCents > 0
      ? formatCad(vars.balanceDueCents)
      : null;
  const isDeposit = vars.paymentMode === "deposit" && Boolean(balanceDue);
  const needsPayment = Boolean(vars.paymentUrl);

  return {
    subject: needsPayment
      ? `Complete payment — ${vars.serviceTitle}`
      : isDeposit
        ? `Deposit received — ${vars.serviceTitle}`
        : `Booking confirmed — ${vars.serviceTitle}`,
    preheader: needsPayment
      ? `Pay to confirm ${vars.serviceTitle} on ${vars.whenLabel}`
      : isDeposit
        ? `Deposit paid · balance due ${balanceDue}`
        : `${vars.serviceTitle} on ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: needsPayment ? "Payment" : isDeposit ? "Deposit" : "Confirmed",
      title: needsPayment ? "Complete your booking" : isDeposit ? "Deposit received" : "You're booked",
      introHtml: needsPayment
        ? `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your appointment time is held — finish payment to confirm.</p>`
        : isDeposit
          ? `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your deposit is confirmed. The remaining balance is due before or at your visit.</p>`
          : `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your appointment is confirmed. We look forward to seeing you at the studio.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "When", value: vars.whenLabel },
        ...(vars.staffName ? [{ label: "With", value: vars.staffName }] : []),
        ...(paid
          ? [{ label: needsPayment ? "Amount due" : isDeposit ? "Deposit paid" : "Paid", value: paid }]
          : []),
        ...(balanceDue && !needsPayment ? [{ label: "Balance due", value: balanceDue }] : []),
      ],
      bodyHtml: needsPayment
        ? `<p style="margin:0;">Use the button below to pay securely. Your hold may expire if payment is not completed.</p>`
        : `<p style="margin:0 0 12px;">Please review policies and pre-care before your visit. Arrive on time — late arrivals may need to be shortened or rescheduled.</p>
        ${
          balanceDue
            ? `<p style="margin:0 0 12px;">Balance of <strong>${escapeHtml(balanceDue)}</strong> can be paid online below or by cash / card at the studio.</p>`
            : ""
        }
        ${
          vars.manageUrl
            ? `<p style="margin:0;">Need to change plans? Use <strong>Cancel / reschedule</strong> below — available until <strong>48 hours</strong> before your appointment.</p>`
            : ""
        }`,
      ctaHtml: needsPayment
        ? [
            emailButton("Complete payment", vars.paymentUrl!),
            ...(vars.manageUrl ? [emailButton("Cancel / reschedule", vars.manageUrl, "ghost")] : []),
            emailButton("Policies", `${base}/policies`, "ghost"),
          ].join("")
        : [
            ...(vars.balancePaymentUrl
              ? [emailButton("Pay remaining balance", vars.balancePaymentUrl)]
              : []),
            ...(vars.manageUrl
              ? [emailButton("Cancel / reschedule", vars.manageUrl, vars.balancePaymentUrl ? "ghost" : "gold")]
              : []),
            emailButton("Pre & aftercare", careHref, "ghost"),
            emailButton("Policies", `${base}/policies`, "ghost"),
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
        ...(typeof vars.amountChargedCents === "number" && vars.amountChargedCents > 0
          ? [{ label: "Charged online", value: formatCad(vars.amountChargedCents) }]
          : []),
        ...(typeof vars.balanceDueCents === "number" && vars.balanceDueCents > 0
          ? [{ label: "Balance due", value: formatCad(vars.balanceDueCents) }]
          : []),
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

export function renderAppointmentCancelledStaff(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `Cancelled — ${vars.clientName} · ${vars.serviceTitle}`,
    preheader: `${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Studio alert",
      title: "Appointment cancelled",
      introHtml: `<p style="margin:0;">A booking was cancelled.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "Was scheduled", value: vars.whenLabel },
        { label: "Client", value: vars.clientName },
        ...(vars.clientEmail ? [{ label: "Email", value: vars.clientEmail }] : []),
        ...(vars.clientPhone ? [{ label: "Phone", value: vars.clientPhone }] : []),
      ],
      ctaHtml: emailButton("Open calendar", `${base}/admin/appointments`),
    }),
  };
}

export function renderAppointmentRescheduled(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `Rescheduled — ${vars.serviceTitle}`,
    preheader: `New time: ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Updated",
      title: "Appointment rescheduled",
      introHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">Your appointment has been moved to a new time.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        ...(vars.previousWhenLabel ? [{ label: "Previously", value: vars.previousWhenLabel }] : []),
        { label: "New time", value: vars.whenLabel },
        ...(vars.staffName ? [{ label: "With", value: vars.staffName }] : []),
      ],
      ctaHtml: [
        ...(vars.manageUrl ? [emailButton("Cancel / reschedule", vars.manageUrl)] : []),
        emailButton("Policies", `${base}/policies`, "ghost"),
      ].join(""),
    }),
  };
}

export function renderAppointmentRescheduledStaff(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  return {
    subject: `Rescheduled — ${vars.clientName} · ${vars.serviceTitle}`,
    preheader: `${vars.previousWhenLabel || ""} → ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Studio alert",
      title: "Appointment rescheduled",
      introHtml: `<p style="margin:0;">A booking was moved to a new time.</p>`,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        ...(vars.previousWhenLabel ? [{ label: "Previously", value: vars.previousWhenLabel }] : []),
        { label: "New time", value: vars.whenLabel },
        { label: "Client", value: vars.clientName },
        ...(vars.clientEmail ? [{ label: "Email", value: vars.clientEmail }] : []),
        ...(vars.clientPhone ? [{ label: "Phone", value: vars.clientPhone }] : []),
      ],
      ctaHtml: emailButton("Open calendar", `${base}/admin/appointments`),
    }),
  };
}

export function renderAppointmentReminder(vars: AppointmentEmailVars): RenderedEmail {
  const studio = studioOf(vars);
  const base = siteUrl();
  const careHref = vars.categorySlug ? `${base}/care/${vars.categorySlug}` : `${base}/care`;
  const defaultIntro = `<p style="margin:0 0 12px;">Hi ${escapeHtml(vars.clientName)},</p>
        <p style="margin:0;">This is a friendly reminder for your upcoming appointment. Please arrive on time and follow any pre-care steps for your treatment.</p>`;
  const payCta = vars.paymentUrl
    ? [emailButton("Complete payment", vars.paymentUrl), emailButton("Pre-care guide", careHref, "ghost")]
    : [
        emailButton("Pre-care guide", careHref),
        ...(vars.manageUrl ? [emailButton("Cancel / reschedule", vars.manageUrl, "ghost")] : []),
        emailButton("Policies", `${base}/policies`, "ghost"),
      ];
  return {
    subject: vars.copyOverride?.subject || `Reminder — ${vars.serviceTitle} tomorrow`,
    preheader: `${vars.serviceTitle} on ${vars.whenLabel}`,
    html: renderEmailLayout({
      studio,
      eyebrow: "Reminder",
      title: vars.paymentUrl ? "Payment still needed" : "See you soon",
      introHtml: vars.copyOverride?.introHtml || defaultIntro,
      detailRows: [
        { label: "Service", value: vars.serviceTitle },
        { label: "When", value: vars.whenLabel },
        ...(vars.staffName ? [{ label: "With", value: vars.staffName }] : []),
        { label: "Location", value: studio.address },
      ],
      ctaHtml: payCta.join(""),
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
    case "appointment_cancelled_staff":
      return renderAppointmentCancelledStaff(vars as AppointmentEmailVars);
    case "appointment_rescheduled":
      return renderAppointmentRescheduled(vars as AppointmentEmailVars);
    case "appointment_rescheduled_staff":
      return renderAppointmentRescheduledStaff(vars as AppointmentEmailVars);
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
    balanceDueCents: 28250,
    paymentMode: "deposit",
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
