import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "published"]),
  excerpt: z.string().optional(),
  content: z.string(),
  seoTitle: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    status: parsed.data.status,
    excerpt: parsed.data.excerpt || "",
    content: parsed.data.content,
    seoTitle: parsed.data.seoTitle || null,
    coverImage: parsed.data.coverImage || null,
  };

  await gate.db.page.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const rows = await gate.db.page.findMany();
  return NextResponse.json(rows);
}
