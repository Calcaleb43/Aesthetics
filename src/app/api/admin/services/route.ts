import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1),
  categorySlug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  sortOrder: z.number(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0).nullable().optional(),
  paymentMode: z.enum(["deposit", "full", "none"]),
  bookable: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const category = await gate.db.serviceCategory.findUnique({
    where: { slug: parsed.data.categorySlug },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  const data = {
    categoryId: category.id,
    title: parsed.data.title,
    summary: parsed.data.summary || "",
    sortOrder: parsed.data.sortOrder,
    durationMinutes: parsed.data.durationMinutes,
    priceCents: parsed.data.priceCents,
    depositCents: parsed.data.depositCents ?? null,
    paymentMode: parsed.data.paymentMode,
    bookable: parsed.data.bookable ?? true,
    status: parsed.data.status,
  };

  await gate.db.service.upsert({
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

  await gate.db.service.delete({ where: { slug: parsed.data.slug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
