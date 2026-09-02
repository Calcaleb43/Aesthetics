import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  serviceSlug: z.string().min(1),
  title: z.string().min(1),
  intro: z.string(),
  status: z.enum(["draft", "published"]),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = {
    title: parsed.data.title,
    intro: parsed.data.intro,
    status: parsed.data.status,
    items: parsed.data.items,
  };

  await gate.db.faq.upsert({
    where: { serviceSlug: parsed.data.serviceSlug },
    create: { serviceSlug: parsed.data.serviceSlug, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
