import type { Database } from "@/lib/db";
import {
  DEFAULT_STUDIO,
  escapeHtml,
  renderEmailLayout,
  type StudioEmailContext,
} from "@/lib/email/layout";
import { siteUrl } from "@/lib/booking/stripe";

export type TemplateVars = Record<string, string | null | undefined>;

export const CUSTOM_TEMPLATE_VAR_HELP = [
  { key: "name", label: "Client name" },
  { key: "email", label: "Client email" },
  { key: "phone", label: "Client phone" },
  { key: "siteName", label: "Studio name" },
  { key: "studioEmail", label: "Studio email" },
  { key: "studioPhone", label: "Studio phone" },
  { key: "address", label: "Studio address" },
  { key: "bookingUrl", label: "Booking URL" },
  { key: "siteUrl", label: "Website URL" },
  { key: "reviewsUrl", label: "Google reviews URL" },
  { key: "serviceTitle", label: "Service title (auto emails)" },
  { key: "whenLabel", label: "Appointment time (auto emails)" },
  { key: "staffName", label: "Staff name (auto emails)" },
] as const;

export function buildRecipientVars(input: {
  name: string;
  email: string;
  phone?: string | null;
  studio: StudioEmailContext;
}): TemplateVars {
  const base = siteUrl();
  return {
    name: input.name,
    email: input.email,
    phone: input.phone || "",
    siteName: input.studio.siteName,
    studioEmail: input.studio.email,
    studioPhone: input.studio.phone,
    address: input.studio.address,
    bookingUrl: input.studio.bookingUrl || `${base}/book-now`,
    siteUrl: base,
    reviewsUrl: input.studio.googleReviewsUrl || "",
  };
}

/** Replace {{var}} tokens. Unknown keys become empty string. */
export function interpolate(template: string, vars: TemplateVars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

function bodyToHtml(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 14px;">${lines}</p>`;
    })
    .join("");
}

export function renderCustomEmail(input: {
  subject: string;
  body: string;
  vars: TemplateVars;
  studio?: StudioEmailContext;
  title?: string;
}) {
  const studio = input.studio || DEFAULT_STUDIO;
  const subject = interpolate(input.subject, input.vars).trim() || "Message from the studio";
  const bodyHtml = bodyToHtml(interpolate(input.body, input.vars));
  const title = input.title || subject;
  const html = renderEmailLayout({
    studio,
    eyebrow: "Message",
    title,
    introHtml: bodyHtml || `<p style="margin:0;">(Empty message)</p>`,
    ctaHtml: undefined,
  });
  return { subject: subject.slice(0, 255), html };
}

export const DEFAULT_CUSTOM_TEMPLATES = [
  {
    slug: "welcome",
    name: "Welcome",
    description: "Warm intro for new or returning clients.",
    subject: "Welcome to {{siteName}}",
    body: `Hi {{name}},

Thank you for connecting with {{siteName}}. We're glad you're here.

If you're ready to book, you can reserve a time online anytime:
{{bookingUrl}}

Questions? Reply to this email or call {{studioPhone}}.

With care,
{{siteName}}`,
    status: "published",
    sortOrder: 1,
  },
  {
    slug: "rebooking-nudge",
    name: "Rebooking nudge",
    description: "Gentle follow-up to invite a return visit.",
    subject: "Ready for your next visit, {{name}}?",
    body: `Hi {{name}},

Just a soft note from {{siteName}} — if you've been thinking about refreshing your look or continuing a treatment plan, we'd love to see you again.

Book here: {{bookingUrl}}

We're at {{address}}.

Warmly,
{{siteName}}`,
    status: "published",
    sortOrder: 2,
  },
  {
    slug: "studio-update",
    name: "Studio update",
    description: "Blank-ish custom note for announcements.",
    subject: "A note from {{siteName}}",
    body: `Hi {{name}},

{{siteName}} here with a quick update:



Reply anytime if you have questions — {{studioEmail}} · {{studioPhone}}.`,
    status: "published",
    sortOrder: 3,
  },
  {
    slug: "appointment_reminder",
    name: "Appointment reminder (auto)",
    description:
      "Automated ~24h before the visit. Edit subject/body to tweak the message. Appointment details and buttons stay fixed.",
    subject: "Reminder — {{serviceTitle}} tomorrow",
    body: `Hi {{name}},

This is a friendly reminder for your upcoming appointment. Please arrive on time and follow any pre-care steps for your treatment.`,
    status: "published",
    sortOrder: 10,
  },
  {
    slug: "appointment_thank_you",
    name: "Thank you / review (auto)",
    description:
      "Automated ~24h after the visit. Includes Google review + rebook buttons when Settings → Reviews has a Google URL.",
    subject: "Thank you — {{siteName}}",
    body: `Hi {{name}},

Thank you for visiting {{siteName}}. We hope you loved your experience.

If you have a moment, a Google review helps others find us — and we'd love to see you again whenever you're ready.`,
    status: "published",
    sortOrder: 11,
  },
] as const;

/** Ensure default templates exist (does not overwrite admin edits). */
export async function ensureDefaultEmailTemplates(db: Database) {
  for (const tpl of DEFAULT_CUSTOM_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { slug: tpl.slug },
      create: { ...tpl },
      update: {},
    });
  }
}
