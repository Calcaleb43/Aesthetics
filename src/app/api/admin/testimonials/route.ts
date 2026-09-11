import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  id: z.union([z.string().uuid(), z.literal("")]).optional(),
  quote: z.string().min(1).max(2000),
  authorName: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  source: z.enum(["google", "other"]).default("google"),
  sourceUrl: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["draft", "published"]),
});

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const rows = await gate.db.testimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    testimonials: rows.map((row) => ({
      id: row.id,
      quote: row.quote,
      authorName: row.authorName,
      rating: row.rating,
      source: row.source,
      sourceUrl: row.sourceUrl || "",
      sortOrder: row.sortOrder,
      status: row.status,
    })),
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const id = parsed.data.id && parsed.data.id.length ? parsed.data.id : randomUUID();
  const data = {
    quote: parsed.data.quote.trim(),
    authorName: parsed.data.authorName.trim(),
    rating: parsed.data.rating,
    source: parsed.data.source,
    sourceUrl: parsed.data.sourceUrl?.trim() || null,
    sortOrder: parsed.data.sortOrder ?? 0,
    status: parsed.data.status,
  };

  await gate.db.testimonial.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.testimonial.delete({ where: { id: parsed.data.id } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
