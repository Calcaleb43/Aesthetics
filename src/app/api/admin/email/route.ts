import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { composeBulk, composeToRecipient, previewCustom } from "@/lib/email/compose";
import { CUSTOM_TEMPLATE_VAR_HELP } from "@/lib/email/custom";
import { hasEmailProvider, loadStudioEmailContext } from "@/lib/email/send";
import { emailTestMessage } from "@/lib/email/resend";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  renderEmailTemplate,
  sampleVarsForTemplate,
  type EmailTemplateKey,
} from "@/lib/email/templates";

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const preview = url.searchParams.get("preview") as EmailTemplateKey | null;
  const customPreview = url.searchParams.get("customPreview");
  const studio = await loadStudioEmailContext(gate.db);

  if (preview && EMAIL_TEMPLATE_KEYS.includes(preview)) {
    const vars = sampleVarsForTemplate(preview);
    const rendered = renderEmailTemplate(preview, { ...vars, studio });
    return NextResponse.json({
      key: preview,
      subject: rendered.subject,
      html: rendered.html,
      meta: EMAIL_TEMPLATE_META[preview],
    });
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
      where: { status: "published" },
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
]);

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
