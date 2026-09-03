import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  serviceSlug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    content: parsed.data.content || "",
    coverImage: parsed.data.coverImage || null,
    status: parsed.data.status,
  };

  await gate.db.careGuide.upsert({
    where: { serviceSlug: parsed.data.serviceSlug },
    create: { serviceSlug: parsed.data.serviceSlug, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = z.object({ serviceSlug: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.careGuide.delete({ where: { serviceSlug: parsed.data.serviceSlug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
