import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  serviceSlug: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    intro: parsed.data.intro || "",
    status: parsed.data.status,
    items: parsed.data.items,
  };

  await gate.db.faq.upsert({
    where: { serviceSlug: parsed.data.serviceSlug },
    create: { serviceSlug: parsed.data.serviceSlug, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ serviceSlug: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.faq.delete({ where: { serviceSlug: parsed.data.serviceSlug } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
