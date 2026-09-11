import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  sortOrder: z.number(),
  durationMinutes: z.number().int().min(0),
  priceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0).nullable().optional(),
  paymentMode: z.enum(["deposit", "full", "none"]),
  bookable: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
  /** Empty = available with any service. Otherwise only when a selected service is in one of these categories. */
  categorySlugs: z.array(z.string()).optional(),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const categorySlugs = parsed.data.categorySlugs || [];
  const categories = categorySlugs.length
    ? await gate.db.serviceCategory.findMany({ where: { slug: { in: categorySlugs } } })
    : [];
  if (categories.length !== categorySlugs.length) {
    return NextResponse.json({ error: "One or more categories not found" }, { status: 400 });
  }

  const data = {
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

  const addon = await gate.db.addon.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  await gate.db.addonCategory.deleteMany({ where: { addonId: addon.id } });
  if (categories.length) {
    await gate.db.addonCategory.createMany({
      data: categories.map((c) => ({ addonId: addon.id, categoryId: c.id })),
    });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ slug: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.addon.delete({ where: { slug: parsed.data.slug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
