import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const rows = await gate.db.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

const mediaSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  label: z.string().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = mediaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const row = await gate.db.mediaAsset.create({
    data: {
      url: parsed.data.url,
      alt: parsed.data.alt || "",
      label: parsed.data.label || "",
    },
  });

  return NextResponse.json(row);
}
