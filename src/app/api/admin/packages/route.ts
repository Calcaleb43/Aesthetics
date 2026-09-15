import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  priceCents: z.number().int().min(0),
  sessionCount: z.number().int().min(1),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const rows = await gate.db.packageOffer.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { services: { select: { serviceId: true } } },
  });

  return NextResponse.json({
    packages: rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      priceCents: p.priceCents,
      sessionCount: p.sessionCount,
      active: p.active,
      sortOrder: p.sortOrder,
      serviceIds: p.services.map((s) => s.serviceId),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const serviceIds = [...new Set(parsed.data.serviceIds || [])];
  if (serviceIds.length) {
    const found = await gate.db.service.count({ where: { id: { in: serviceIds } } });
    if (found !== serviceIds.length) {
      return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
    }
  }

  const data = {
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || "",
    priceCents: parsed.data.priceCents,
    sessionCount: parsed.data.sessionCount,
    active: parsed.data.active ?? true,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  const offer = await gate.db.packageOffer.upsert({
    where: { slug: parsed.data.slug },
    create: { slug: parsed.data.slug, ...data },
    update: data,
  });

  await gate.db.packageService.deleteMany({ where: { packageId: offer.id } });
  if (serviceIds.length) {
    await gate.db.packageService.createMany({
      data: serviceIds.map((serviceId) => ({ packageId: offer.id, serviceId })),
    });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      slug: z.string().min(1).optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { id, slug } = parsed.data;
  if (!id && !slug) {
    return NextResponse.json({ error: "id or slug required" }, { status: 400 });
  }

  if (id) {
    await gate.db.packageOffer.delete({ where: { id } });
  } else {
    await gate.db.packageOffer.delete({ where: { slug: slug! } });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}
