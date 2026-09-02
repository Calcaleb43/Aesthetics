import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  tagline: z.string(),
  summary: z.string(),
  content: z.string(),
  coverImage: z.string().nullable().optional(),
  bookingUrl: z.string().nullable().optional(),
  sortOrder: z.number(),
  status: z.enum(["draft", "published"]),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    shortTitle: parsed.data.shortTitle,
    tagline: parsed.data.tagline,
    summary: parsed.data.summary,
    content: parsed.data.content,
    coverImage: parsed.data.coverImage || null,
    bookingUrl: parsed.data.bookingUrl || null,
    sortOrder: parsed.data.sortOrder,
    status: parsed.data.status,
  };

  await gate.db.service.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
