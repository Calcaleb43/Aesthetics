import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  tagline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  bookingUrl: z.string().nullable().optional(),
  sortOrder: z.number(),
  featured: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    shortTitle: parsed.data.shortTitle,
    tagline: parsed.data.tagline || "",
    summary: parsed.data.summary || "",
    content: parsed.data.content || "",
    coverImage: parsed.data.coverImage || null,
    bookingUrl: parsed.data.bookingUrl || null,
    sortOrder: parsed.data.sortOrder,
    featured: parsed.data.featured ?? true,
    status: parsed.data.status,
  };

  await gate.db.serviceCategory.upsert({
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

  await gate.db.serviceCategory.delete({ where: { slug: parsed.data.slug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
