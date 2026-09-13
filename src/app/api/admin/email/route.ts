import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
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

  const take = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || "40")));
  const rows = await gate.db.emailMessage.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({
    configured: hasEmailProvider(),
    from: process.env.EMAIL_FROM || null,
    studioEmail: studio.email,
    templates: EMAIL_TEMPLATE_KEYS.map((key) => ({
      key,
      ...EMAIL_TEMPLATE_META[key],
    })),
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
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const postSchema = z.object({
  action: z.enum(["test"]),
  to: z.string().email().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
