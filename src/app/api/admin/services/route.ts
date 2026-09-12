import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0).nullable().optional(),
  paymentMode: z.enum(["deposit", "full", "none"]),
  bookable: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
});

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
  variants: z.array(variantSchema).optional(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

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

  const service = await gate.db.service.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  if (parsed.data.variants) {
    const incoming = parsed.data.variants.map((v, index) => ({
      ...v,
      slug: slugify(v.slug || v.title) || `variant-${index + 1}`,
      summary: v.summary || "",
      bookable: v.bookable ?? true,
      depositCents: v.depositCents ?? null,
    }));

    const slugSet = new Set(incoming.map((v) => v.slug));
    if (slugSet.size !== incoming.length) {
      return NextResponse.json({ error: "Variant slugs must be unique within a service" }, { status: 400 });
    }

    const existing = await gate.db.serviceVariant.findMany({
      where: { serviceId: service.id },
      select: { id: true, slug: true },
    });
    const existingBySlug = new Map(existing.map((v) => [v.slug, v.id]));
    const keepIds = new Set<string>();

    for (const [index, variant] of incoming.entries()) {
      const id = variant.id || existingBySlug.get(variant.slug);
      if (id) {
        keepIds.add(id);
        await gate.db.serviceVariant.update({
          where: { id },
          data: {
            slug: variant.slug,
            title: variant.title,
            summary: variant.summary,
            sortOrder: variant.sortOrder ?? index,
            durationMinutes: variant.durationMinutes,
            priceCents: variant.priceCents,
            depositCents: variant.depositCents,
            paymentMode: variant.paymentMode,
            bookable: variant.bookable,
            status: variant.status,
          },
        });
      } else {
        const created = await gate.db.serviceVariant.create({
          data: {
            serviceId: service.id,
            slug: variant.slug,
            title: variant.title,
            summary: variant.summary,
            sortOrder: variant.sortOrder ?? index,
            durationMinutes: variant.durationMinutes,
            priceCents: variant.priceCents,
            depositCents: variant.depositCents,
            paymentMode: variant.paymentMode,
            bookable: variant.bookable,
            status: variant.status,
          },
        });
        keepIds.add(created.id);
      }
    }

    await gate.db.serviceVariant.deleteMany({
      where: {
        serviceId: service.id,
        ...(keepIds.size ? { id: { notIn: [...keepIds] } } : {}),
      },
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

  await gate.db.service.delete({ where: { slug: parsed.data.slug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
