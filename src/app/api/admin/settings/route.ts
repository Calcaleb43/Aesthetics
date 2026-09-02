import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

const schema = z.object({
  siteName: z.string(),
  tagline: z.string(),
  subtitle: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  instagramUrl: z.string(),
  bookingUrl: z.string(),
  heroImage: z.string(),
  aboutImage: z.string(),
  galleryImages: z.array(z.string()),
  homeIntro: z.string(),
  whyHeadline: z.string(),
  whyBody: z.string(),
  values: z.array(z.object({ title: z.string(), body: z.string() })),
  meetAnie: z.string(),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
