import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { DEFAULT_CUSTOM_TEMPLATES } from "@/lib/email/custom";

const schema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  status: z.enum(["draft", "published"]),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  let rows = await gate.db.emailTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (!rows.length) {
    for (const tpl of DEFAULT_CUSTOM_TEMPLATES) {
      await gate.db.emailTemplate.upsert({
        where: { slug: tpl.slug },
        create: { ...tpl },
        update: {},
      });
    }
    rows = await gate.db.emailTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  return NextResponse.json({
    templates: rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      subject: t.subject,
      body: t.body,
      status: t.status,
      sortOrder: t.sortOrder,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data = {
    name: parsed.data.name,
    description: parsed.data.description || "",
    subject: parsed.data.subject,
    body: parsed.data.body,
    status: parsed.data.status,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await gate.db.emailTemplate.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ slug: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.emailTemplate.delete({ where: { slug: parsed.data.slug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
