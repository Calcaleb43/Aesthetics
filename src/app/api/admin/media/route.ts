import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { z } from "zod";
import { normalizeMediaUrl } from "@/lib/admin/media-url";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

export type MediaDto = {
  id: string;
  url: string;
  alt: string;
  label: string;
  pathname: string | null;
  contentType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  url: string;
  alt: string;
  label: string;
  pathname: string | null;
  contentType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
}): MediaDto {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    label: row.label,
    pathname: row.pathname,
    contentType: row.contentType,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const rows = await gate.db.mediaAsset.findMany({
    where: q
      ? {
          OR: [
            { label: { contains: q, mode: "insensitive" } },
            { alt: { contains: q, mode: "insensitive" } },
            { url: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: rows.map(mapRow),
    uploadEnabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}

const createSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  pathname: z.string().optional().nullable(),
  contentType: z.string().optional().nullable(),
  bytes: z.number().int().positive().optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid URL or fields" }, { status: 400 });

  const normalized = normalizeMediaUrl(parsed.data.url);
  if (!normalized.url) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const row = await gate.db.mediaAsset.create({
    data: {
      url: normalized.url,
      alt: parsed.data.alt || "",
      label: parsed.data.label || "",
      pathname: parsed.data.pathname || null,
      contentType: parsed.data.contentType || null,
      bytes: parsed.data.bytes ?? null,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
    },
  });

  revalidateSite();
  return NextResponse.json({
    ...mapRow(row),
    note: normalized.note,
  });
}

const updateSchema = z.object({
  id: z.string().uuid(),
  alt: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const row = await gate.db.mediaAsset.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt || "" } : {}),
      ...(parsed.data.label !== undefined ? { label: parsed.data.label || "" } : {}),
    },
  });

  revalidateSite();
  return NextResponse.json(mapRow(row));
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const existing = await gate.db.mediaAsset.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.pathname && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(existing.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (err) {
      console.warn("Blob delete failed", err);
    }
  }

  await gate.db.mediaAsset.delete({ where: { id: parsed.data.id } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
