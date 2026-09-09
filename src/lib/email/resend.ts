import { Resend } from "resend";
import { formatCad } from "@/lib/booking/money";

let client: Resend | null = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

function fromAddress() {
  return process.env.EMAIL_FROM || "Aniekanvas Aesthetics <onboarding@resend.dev>";
}

export async function sendEmail(input: { to: string | string[]; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) {
    console.info("[email] skipped (RESEND_API_KEY unset):", input.subject, input.to);
    return { skipped: true as const };
  }
  try {
    await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { skipped: false as const };
  } catch (err) {
    console.error("[email] send failed", err);
    return { skipped: false as const, error: true as const };
  }
}

function wrap(body: string) {
  return `<div style="font-family:Figtree,Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
    <p style="letter-spacing:0.2em;text-transform:uppercase;color:#9a7a32;font-size:12px">Aniekanvas Aesthetics</p>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#666">146 Thirtieth Street, Suite 218, Toronto</p>
  </div>`;
}

export async function emailAppointmentBooked(input: {
  to: string;
  clientName: string;
  serviceTitle: string;
  whenLabel: string;
  staffName?: string | null;
  amountChargedCents?: number;
  isStaff?: boolean;
}) {
  const subject = input.isStaff
    ? `New booking: ${input.serviceTitle}`
    : `Booking confirmed: ${input.serviceTitle}`;
  const html = wrap(`
    <h1 style="font-size:22px">${input.isStaff ? "New appointment" : "You're booked"}</h1>
    <p>Hi ${input.isStaff ? input.staffName || "team" : input.clientName},</p>
    <p><strong>${input.serviceTitle}</strong></p>
    <p>${input.whenLabel}</p>
    ${input.staffName && !input.isStaff ? `<p>With ${input.staffName}</p>` : ""}
    ${input.isStaff ? `<p>Client: ${input.clientName} &lt;${input.to}&gt;</p>` : ""}
    ${
      typeof input.amountChargedCents === "number" && input.amountChargedCents > 0
        ? `<p>Payment received: ${formatCad(input.amountChargedCents)}</p>`
        : ""
    }
  `);
  return sendEmail({ to: input.to, subject, html });
}

export async function emailAppointmentCancelled(input: {
  to: string;
  clientName: string;
  serviceTitle: string;
  whenLabel: string;
}) {
  return sendEmail({
    to: input.to,
    subject: `Cancelled: ${input.serviceTitle}`,
    html: wrap(`
      <h1 style="font-size:22px">Appointment cancelled</h1>
      <p>Hi ${input.clientName},</p>
      <p>Your <strong>${input.serviceTitle}</strong> on ${input.whenLabel} has been cancelled.</p>
      <p>Reply to this studio if you need to rebook.</p>
    `),
  });
}

export async function emailAppointmentReminder(input: {
  to: string;
  clientName: string;
  serviceTitle: string;
  whenLabel: string;
}) {
  return sendEmail({
    to: input.to,
    subject: `Reminder: ${input.serviceTitle} tomorrow`,
    html: wrap(`
      <h1 style="font-size:22px">Appointment reminder</h1>
      <p>Hi ${input.clientName},</p>
      <p>This is a reminder for <strong>${input.serviceTitle}</strong> on ${input.whenLabel}.</p>
      <p>Please arrive on time and review your pre-care guidance.</p>
    `),
  });
}
