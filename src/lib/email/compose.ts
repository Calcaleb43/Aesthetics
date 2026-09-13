import { randomUUID } from "crypto";
import type { Database } from "@/lib/db";
import {
  buildRecipientVars,
  renderCustomEmail,
} from "@/lib/email/custom";
import { loadStudioEmailContext, sendEmail } from "@/lib/email/send";

export type ComposeRecipient = {
  email: string;
  name: string;
  phone?: string | null;
  clientId?: string | null;
};

async function resolveTemplateBody(
  db: Database,
  input: {
    templateSlug?: string | null;
    subject?: string | null;
    body?: string | null;
  },
) {
  if (input.templateSlug) {
    const tpl = await db.emailTemplate.findUnique({ where: { slug: input.templateSlug } });
    if (!tpl || tpl.status !== "published") {
      return { error: "Template not found or not published" as const };
    }
    return {
      subject: input.subject?.trim() || tpl.subject,
      body: input.body?.trim() || tpl.body,
      templateKey: `custom:${tpl.slug}`,
      templateSlug: tpl.slug,
    };
  }
  if (!input.subject?.trim() || !input.body?.trim()) {
    return { error: "Subject and body are required" as const };
  }
  return {
    subject: input.subject.trim(),
    body: input.body.trim(),
    templateKey: "composed",
    templateSlug: null as string | null,
  };
}

export async function composeToRecipient(
  db: Database,
  input: {
    recipient: ComposeRecipient;
    templateSlug?: string | null;
    subject?: string | null;
    body?: string | null;
    campaignId?: string | null;
  },
) {
  const resolved = await resolveTemplateBody(db, input);
  if ("error" in resolved) return { ok: false as const, error: resolved.error };

  const studio = await loadStudioEmailContext(db);
  const vars = buildRecipientVars({
    name: input.recipient.name,
    email: input.recipient.email,
    phone: input.recipient.phone,
    studio,
  });
  const rendered = renderCustomEmail({
    subject: resolved.subject,
    body: resolved.body,
    vars,
    studio,
  });

  const result = await sendEmail({
    db,
    to: input.recipient.email,
    toName: input.recipient.name,
    subject: rendered.subject,
    html: rendered.html,
    templateKey: resolved.templateKey,
    clientId: input.recipient.clientId,
    campaignId: input.campaignId,
    metadata: {
      mode: input.campaignId ? "bulk" : "compose",
      templateSlug: resolved.templateSlug,
    },
  });

  return {
    ok: true as const,
    result,
    subject: rendered.subject,
  };
}

export async function composeBulk(
  db: Database,
  input: {
    recipients: ComposeRecipient[];
    templateSlug?: string | null;
    subject?: string | null;
    body?: string | null;
  },
) {
  const recipients = input.recipients
    .map((r) => ({
      ...r,
      email: r.email.trim().toLowerCase(),
      name: r.name.trim() || "Client",
    }))
    .filter((r) => r.email.includes("@"));

  if (!recipients.length) {
    return { ok: false as const, error: "No valid recipients" };
  }
  if (recipients.length > 200) {
    return { ok: false as const, error: "Bulk sends are limited to 200 recipients per batch" };
  }

  const resolved = await resolveTemplateBody(db, input);
  if ("error" in resolved) return { ok: false as const, error: resolved.error };

  const campaignId = randomUUID();
  const results: { email: string; status: string; error?: boolean }[] = [];

  for (const recipient of recipients) {
    const out = await composeToRecipient(db, {
      recipient,
      templateSlug: input.templateSlug,
      subject: input.subject,
      body: input.body,
      campaignId,
    });
    if (!out.ok) {
      results.push({ email: recipient.email, status: "failed", error: true });
      continue;
    }
    results.push({
      email: recipient.email,
      status: out.result.status,
      error: out.result.error,
    });
    // Light pacing to avoid provider bursts
    await new Promise((r) => setTimeout(r, 80));
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed" || r.error).length;

  return {
    ok: true as const,
    campaignId,
    total: recipients.length,
    sent,
    skipped,
    failed,
    results,
  };
}

export async function previewCustom(
  db: Database,
  input: {
    templateSlug?: string | null;
    subject?: string | null;
    body?: string | null;
    name?: string;
    email?: string;
    phone?: string | null;
  },
) {
  const resolved = await resolveTemplateBody(db, input);
  if ("error" in resolved) return { ok: false as const, error: resolved.error };
  const studio = await loadStudioEmailContext(db);
  const vars = buildRecipientVars({
    name: input.name || "Alex Client",
    email: input.email || "alex@example.com",
    phone: input.phone || "(416) 555-0100",
    studio,
  });
  const rendered = renderCustomEmail({
    subject: resolved.subject,
    body: resolved.body,
    vars,
    studio,
  });
  return { ok: true as const, ...rendered, templateKey: resolved.templateKey };
}
