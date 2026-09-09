import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const rows = await gate.db.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

const mediaSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = mediaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid URL or fields" }, { status: 400 });

  const row = await gate.db.mediaAsset.create({
    data: {
      url: parsed.data.url,
      alt: parsed.data.alt || "",
      label: parsed.data.label || "",
    },
  });

  revalidateSite();
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.mediaAsset.delete({ where: { id: parsed.data.id } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
