import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { absoluteUrl } from "@/lib/seo";
import { getBlobAccess, mediaAssetPublicPath } from "@/lib/blob";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

function slugifyFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "bin";
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${safe || "image"}-${Date.now()}.${ext || "bin"}`;
}

async function readImageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  void file;
  return { width: null, height: null };
}

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Uploads are not configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob), or paste an external image URL instead.",
      },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF, or SVG images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 12MB or smaller" }, { status: 400 });
  }

  const label = String(form.get("label") || file.name || "").slice(0, 200);
  const alt = String(form.get("alt") || "").slice(0, 500);
  const pathname = `media/${slugifyFilename(file.name)}`;
  const access = getBlobAccess();

  try {
    const blob = await put(pathname, file, {
      access,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      addRandomSuffix: true,
    });

    const size = await readImageSize(file);
    const row = await gate.db.mediaAsset.create({
      data: {
        // Placeholder; rewritten below for private stores so CMS picks a site URL.
        url: blob.url,
        pathname: blob.pathname,
        contentType: file.type,
        bytes: file.size,
        label: label || file.name,
        alt,
        width: size.width,
        height: size.height,
      },
    });

    const publicUrl =
      access === "private" ? absoluteUrl(mediaAssetPublicPath(row.id)) : blob.url;

    const saved =
      publicUrl !== row.url
        ? await gate.db.mediaAsset.update({
            where: { id: row.id },
            data: { url: publicUrl },
          })
        : row;

    revalidateSite();
    return NextResponse.json({
      id: saved.id,
      url: saved.url,
      alt: saved.alt,
      label: saved.label,
      pathname: saved.pathname,
      contentType: saved.contentType,
      bytes: saved.bytes,
      width: saved.width,
      height: saved.height,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Media upload failed", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      {
        error: message.includes("private store")
          ? "Blob store is private — set BLOB_ACCESS=private (default) or use a public store with BLOB_ACCESS=public."
          : "Upload failed",
      },
      { status: 500 },
    );
  }
}
