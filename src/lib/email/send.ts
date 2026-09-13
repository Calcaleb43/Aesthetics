import { Resend } from "resend";
import { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/lib/db";
import { hasDatabase, getPrisma } from "@/lib/db";
import type { EmailTemplateKey } from "@/lib/email/templates";
import type { StudioEmailContext } from "@/lib/email/layout";
import { DEFAULT_STUDIO } from "@/lib/email/layout";

let client: Resend | null = null;

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function hasEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress() {
  return process.env.EMAIL_FROM || "Aniekanvas Aesthetics <onboarding@resend.dev>";
}

export async function loadStudioEmailContext(db?: Database | null): Promise<StudioEmailContext> {
  if (!db && !hasDatabase()) return DEFAULT_STUDIO;
  try {
    const prisma = db || getPrisma();
    const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_STUDIO;
    return {
      siteName: row.siteName || DEFAULT_STUDIO.siteName,
      email: row.email || DEFAULT_STUDIO.email,
      phone: row.phone || DEFAULT_STUDIO.phone,
      address: row.address || DEFAULT_STUDIO.address,
      instagramUrl: row.instagramUrl || DEFAULT_STUDIO.instagramUrl,
      bookingUrl: row.bookingUrl || undefined,
    };
  } catch {
    return DEFAULT_STUDIO;
  }
}

export type SendEmailInput = {
  to: string | string[];
  toName?: string | null;
  subject: string;
  html: string;
  templateKey: EmailTemplateKey | string;
  replyTo?: string | null;
  appointmentId?: string | null;
  inquiryId?: string | null;
  metadata?: Record<string, unknown>;
  /** When provided, logs to EmailMessage even if DB gate elsewhere failed */
  db?: Database | null;
};

export type SendEmailResult = {
  skipped: boolean;
  error?: boolean;
  providerId?: string | null;
  messageId?: string | null;
  status: "sent" | "skipped" | "failed";
};

async function logMessage(
  db: Database | null | undefined,
  data: {
    templateKey: string;
    toEmail: string;
    toName?: string | null;
    subject: string;
    status: string;
    providerId?: string | null;
    error?: string | null;
    appointmentId?: string | null;
    inquiryId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (!db && !hasDatabase()) return null;
  try {
    const prisma = db || getPrisma();
    const row = await prisma.emailMessage.create({
      data: {
        templateKey: data.templateKey,
        toEmail: data.toEmail,
        toName: data.toName || null,
        subject: data.subject.slice(0, 255),
        status: data.status,
        providerId: data.providerId || null,
        error: data.error || null,
        appointmentId: data.appointmentId || null,
        inquiryId: data.inquiryId || null,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });
    return row.id;
  } catch (err) {
    console.error("[email] log failed", err);
    return null;
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const primary = recipients[0] || "";
  const resend = getResend();

  if (!resend || !primary) {
    console.info("[email] skipped:", input.templateKey, input.subject, recipients);
    const messageId = await logMessage(input.db, {
      templateKey: input.templateKey,
      toEmail: primary || "unknown",
      toName: input.toName,
      subject: input.subject,
      status: "skipped",
      appointmentId: input.appointmentId,
      inquiryId: input.inquiryId,
      metadata: { ...input.metadata, reason: !resend ? "RESEND_API_KEY unset" : "no recipient" },
    });
    return { skipped: true, status: "skipped", messageId };
  }

  try {
    const studio = await loadStudioEmailContext(input.db);
    const result = await resend.emails.send({
      from: fromAddress(),
      to: recipients,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo || studio.email || undefined,
    });

    if (result.error) {
      console.error("[email] provider error", result.error);
      const messageId = await logMessage(input.db, {
        templateKey: input.templateKey,
        toEmail: primary,
        toName: input.toName,
        subject: input.subject,
        status: "failed",
        error: result.error.message || String(result.error),
        appointmentId: input.appointmentId,
        inquiryId: input.inquiryId,
        metadata: input.metadata,
      });
      return { skipped: false, error: true, status: "failed", messageId };
    }

    const providerId = result.data?.id || null;
    const messageId = await logMessage(input.db, {
      templateKey: input.templateKey,
      toEmail: primary,
      toName: input.toName,
      subject: input.subject,
      status: "sent",
      providerId,
      appointmentId: input.appointmentId,
      inquiryId: input.inquiryId,
      metadata: input.metadata,
    });
    return { skipped: false, status: "sent", providerId, messageId };
  } catch (err) {
    console.error("[email] send failed", err);
    const messageId = await logMessage(input.db, {
      templateKey: input.templateKey,
      toEmail: primary,
      toName: input.toName,
      subject: input.subject,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      appointmentId: input.appointmentId,
      inquiryId: input.inquiryId,
      metadata: input.metadata,
    });
    return { skipped: false, error: true, status: "failed", messageId };
  }
}

export async function studioManagerEmails(db: Database) {
  const rows = await db.admin.findMany({
    where: { active: true, role: { in: ["owner", "manager"] } },
    select: { email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((r) => r.email.includes("@"));
}
