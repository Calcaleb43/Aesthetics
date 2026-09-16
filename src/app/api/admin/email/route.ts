import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { composeBulk, composeToRecipient, previewCustom } from "@/lib/email/compose";
import {
  CUSTOM_TEMPLATE_VAR_HELP,
  DEFAULT_CUSTOM_TEMPLATES,
  ensureDefaultEmailTemplates,
  SYSTEM_EMAIL_TEMPLATE_SLUGS,
} from "@/lib/email/custom";
import { draftCopyOverride } from "@/lib/email/overrides";
import { hasEmailProvider, loadStudioEmailContext } from "@/lib/email/send";
import { emailTestMessage } from "@/lib/email/resend";
import { siteUrl } from "@/lib/booking/stripe";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  renderEmailTemplate,
  sampleVarsForTemplate,
  type AppointmentEmailVars,
  type EmailTemplateKey,
  type InquiryEmailVars,
} from "@/lib/email/templates";

function sampleInterpVars(key: EmailTemplateKey, studio: Awaited<ReturnType<typeof loadStudioEmailContext>>) {
  const base = siteUrl();
  const sample = sampleVarsForTemplate(key);
  if (key === "inquiry_received" || key === "inquiry_alert") {
    const v = sample as InquiryEmailVars;
    return {
      name: v.name,
      email: v.email,
      phone: v.phone || "",
      siteName: studio.siteName,
      studioEmail: studio.email,
      studioPhone: studio.phone,
      address: studio.address,
      bookingUrl: studio.bookingUrl || `${base}/book-now`,
      siteUrl: base,
      reviewsUrl: studio.googleReviewsUrl || "",
      serviceTitle: v.serviceInterest || "",
      whenLabel: "",
      staffName: "",
      message: v.message,
    };
  }
  if (key === "test_email") {
    return {
      name: "Admin",
      email: studio.email,
      phone: studio.phone,
      siteName: studio.siteName,
      studioEmail: studio.email,
      studioPhone: studio.phone,
      address: studio.address,
      bookingUrl: studio.bookingUrl || `${base}/book-now`,
      siteUrl: base,
      reviewsUrl: studio.googleReviewsUrl || "",
    };
  }
  const v = sample as AppointmentEmailVars;
  return {
    name: v.clientName,
    email: v.clientEmail || "",
    phone: v.clientPhone || "",
    siteName: studio.siteName,
    studioEmail: studio.email,
    studioPhone: studio.phone,
    address: studio.address,
    bookingUrl: studio.bookingUrl || `${base}/book-now`,
    siteUrl: base,
    reviewsUrl: studio.googleReviewsUrl || "",
    serviceTitle: v.serviceTitle,
    whenLabel: v.whenLabel,
    staffName: v.staffName || "",
  };
}

async function renderSystemPreview(
  db: Parameters<typeof ensureDefaultEmailTemplates>[0],
  key: EmailTemplateKey,
  studio: Awaited<ReturnType<typeof loadStudioEmailContext>>,
  draft?: { subject?: string | null; body?: string | null },
) {
  const vars = sampleVarsForTemplate(key);
  const interp = sampleInterpVars(key, studio);
  let copyOverride = null as ReturnType<typeof draftCopyOverride>;

  if (draft && (draft.subject != null || draft.body != null)) {
    copyOverride = draftCopyOverride(draft.subject, draft.body, interp);
  } else {
    const row = await db.emailTemplate.findUnique({ where: { slug: key } });
    if (row && row.status === "published") {
      copyOverride = draftCopyOverride(row.subject, row.body, interp);
    }
  }

  const rendered = renderEmailTemplate(key, { ...vars, studio, copyOverride });
  const defaults = DEFAULT_CUSTOM_TEMPLATES.find((t) => t.slug === key);
  const row = await db.emailTemplate.findUnique({ where: { slug: key } });

  return {
    key,
    subject: rendered.subject,
    html: rendered.html,
    meta: EMAIL_TEMPLATE_META[key],
    editable: {
      subject: draft?.subject ?? row?.subject ?? defaults?.subject ?? "",
      body: draft?.body ?? row?.body ?? defaults?.body ?? "",
      status: row?.status ?? "published",
      name: row?.name ?? defaults?.name ?? EMAIL_TEMPLATE_META[key].label,
      description: row?.description ?? defaults?.description ?? EMAIL_TEMPLATE_META[key].description,
    },
  };
}

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  await ensureDefaultEmailTemplates(gate.db);

  const url = new URL(req.url);
  const preview = url.searchParams.get("preview") as EmailTemplateKey | null;
  const customPreview = url.searchParams.get("customPreview");
  const studio = await loadStudioEmailContext(gate.db);

  if (preview && EMAIL_TEMPLATE_KEYS.includes(preview)) {
    const out = await renderSystemPreview(gate.db, preview, studio);
    return NextResponse.json(out);
  }

  if (customPreview) {
    const out = await previewCustom(gate.db, { templateSlug: customPreview });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 404 });
    return NextResponse.json({ key: customPreview, subject: out.subject, html: out.html });
  }

  const take = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || "40")));
  const [rows, customTemplates, clientCount] = await Promise.all([
    gate.db.emailMessage.findMany({
      orderBy: { createdAt: "desc" },
      take,
    }),
    gate.db.emailTemplate.findMany({
      where: {
        status: "published",
        NOT: { slug: { in: [...SYSTEM_EMAIL_TEMPLATE_SLUGS] } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, description: true, subject: true },
    }),
    gate.db.client.count({ where: { banned: false } }),
  ]);

  return NextResponse.json({
    configured: hasEmailProvider(),
    from: process.env.EMAIL_FROM || null,
    studioEmail: studio.email,
    variables: CUSTOM_TEMPLATE_VAR_HELP,
    systemTemplates: EMAIL_TEMPLATE_KEYS.map((key) => ({
      key,
      ...EMAIL_TEMPLATE_META[key],
    })),
    customTemplates,
    clientCount,
    messages: rows.map((row) => ({
      id: row.id,
      templateKey: row.templateKey,
      toEmail: row.toEmail,
      toName: row.toName,
      subject: row.subject,
      status: row.status,
      providerId: row.providerId,
      error: row.error,
      appointmentId: row.appointmentId,
      inquiryId: row.inquiryId,
      clientId: row.clientId,
      campaignId: row.campaignId,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test"),
    to: z.string().email().optional(),
  }),
  z.object({
    action: z.literal("compose"),
    clientId: z.string().uuid().optional(),
    toEmail: z.string().email().optional(),
    toName: z.string().min(1).max(160).optional(),
    toPhone: z.string().max(64).nullable().optional(),
    templateSlug: z.string().min(1).optional().nullable(),
    subject: z.string().max(255).optional().nullable(),
    body: z.string().max(20000).optional().nullable(),
  }),
  z.object({
    action: z.literal("bulk"),
    clientIds: z.array(z.string().uuid()).optional(),
    allActiveClients: z.boolean().optional(),
    templateSlug: z.string().min(1).optional().nullable(),
    subject: z.string().max(255).optional().nullable(),
    body: z.string().max(20000).optional().nullable(),
  }),
  z.object({
    action: z.literal("preview"),
    templateSlug: z.string().min(1).optional().nullable(),
    subject: z.string().max(255).optional().nullable(),
    body: z.string().max(20000).optional().nullable(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  }),
  z.object({
    action: z.literal("previewSystem"),
    key: z.string().min(1),
    subject: z.string().max(255).optional().nullable(),
    body: z.string().max(20000).optional().nullable(),
  }),
  z.object({
    action: z.literal("saveSystem"),
    key: z.string().min(1),
    subject: z.string().min(1).max(255),
    body: z.string().min(1).max(20000),
    status: z.enum(["draft", "published"]).optional(),
  }),
]);

function asTemplateKey(key: string): EmailTemplateKey | null {
  return EMAIL_TEMPLATE_KEYS.includes(key as EmailTemplateKey) ? (key as EmailTemplateKey) : null;
}
export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (parsed.data.action === "test") {
    const to = parsed.data.to || gate.session.email;
    if (!to) return NextResponse.json({ error: "No recipient" }, { status: 400 });
    if (!hasEmailProvider()) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured on this environment" },
        { status: 503 },
      );
    }
    const result = await emailTestMessage({ to, db: gate.db });
    if (result.error) {
      return NextResponse.json({ error: "Send failed — check server logs" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: result.status, providerId: result.providerId });
  }

  if (parsed.data.action === "preview") {
    const out = await previewCustom(gate.db, parsed.data);
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json({ ok: true, subject: out.subject, html: out.html });
  }

  if (parsed.data.action === "previewSystem") {
    const key = asTemplateKey(parsed.data.key);
    if (!key) return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    await ensureDefaultEmailTemplates(gate.db);
    const studio = await loadStudioEmailContext(gate.db);
    const out = await renderSystemPreview(gate.db, key, studio, {
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    return NextResponse.json({ ok: true, ...out });
  }

  if (parsed.data.action === "saveSystem") {
    const key = asTemplateKey(parsed.data.key);
    if (!key) return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    await ensureDefaultEmailTemplates(gate.db);
    const defaults = DEFAULT_CUSTOM_TEMPLATES.find((t) => t.slug === key);
    const meta = EMAIL_TEMPLATE_META[key];
    await gate.db.emailTemplate.upsert({
      where: { slug: key },
      create: {
        slug: key,
        name: defaults?.name || meta.label,
        description: defaults?.description || meta.description,
        subject: parsed.data.subject,
        body: parsed.data.body,
        status: parsed.data.status || "published",
        sortOrder: defaults?.sortOrder ?? 50,
      },
      update: {
        subject: parsed.data.subject,
        body: parsed.data.body,
        status: parsed.data.status || "published",
      },
    });
    const studio = await loadStudioEmailContext(gate.db);
    const out = await renderSystemPreview(gate.db, key, studio);
    return NextResponse.json({ ok: true, ...out });
  }

  if (parsed.data.action === "compose") {
    if (!hasEmailProvider()) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured on this environment" },
        { status: 503 },
      );
    }

    let recipient = {
      email: parsed.data.toEmail || "",
      name: parsed.data.toName || "Client",
      phone: parsed.data.toPhone || null,
      clientId: parsed.data.clientId || null,
    };

    if (parsed.data.clientId) {
      const client = await gate.db.client.findUnique({ where: { id: parsed.data.clientId } });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
      if (client.banned) return NextResponse.json({ error: "Client is banned" }, { status: 400 });
      recipient = {
        email: client.email,
        name: client.name,
        phone: client.phone,
        clientId: client.id,
      };
    }

    if (!recipient.email.includes("@")) {
      return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
    }

    const out = await composeToRecipient(gate.db, {
      recipient,
      templateSlug: parsed.data.templateSlug,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    if (out.result.error) {
      return NextResponse.json({ error: "Send failed — check server logs" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      status: out.result.status,
      providerId: out.result.providerId,
      subject: out.subject,
    });
  }

  if (parsed.data.action === "bulk") {
    if (!hasEmailProvider()) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured on this environment" },
        { status: 503 },
      );
    }

    let clients;
    if (parsed.data.allActiveClients) {
      clients = await gate.db.client.findMany({
        where: { banned: false },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, email: true, name: true, phone: true },
      });
    } else if (parsed.data.clientIds?.length) {
      clients = await gate.db.client.findMany({
        where: { id: { in: parsed.data.clientIds }, banned: false },
        select: { id: true, email: true, name: true, phone: true },
      });
    } else {
      return NextResponse.json({ error: "Select clients or choose all active" }, { status: 400 });
    }

    const out = await composeBulk(gate.db, {
      recipients: clients.map((c) => ({
        clientId: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
      })),
      templateSlug: parsed.data.templateSlug,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json(out);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
