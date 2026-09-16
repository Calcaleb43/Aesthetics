import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getBlobAccess } from "@/lib/blob";
import { getPrisma, hasDatabase } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Public delivery for CMS media. Private Blob stores are not CDN-readable;
 * this streams by asset id after looking up the stored pathname.
 */
export async function GET(_req: Request, { params }: Params) {
  if (!hasDatabase()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  if (!id) return new NextResponse("Not found", { status: 404 });

  const db = getPrisma();
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const access = getBlobAccess();
  const key = asset.pathname || asset.url;

  // External / pasted URLs: redirect instead of proxying.
  if (!asset.pathname && /^https?:\/\//i.test(asset.url) && !asset.url.includes("blob.vercel-storage.com")) {
    return NextResponse.redirect(asset.url, 302);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && access === "private") {
    return new NextResponse("Media unavailable", { status: 503 });
  }

  try {
    const result = await get(key, {
      access,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      result.blob.contentType || asset.contentType || "application/octet-stream",
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (result.blob.size != null) headers.set("Content-Length", String(result.blob.size));

    return new NextResponse(result.stream, { status: 200, headers });
  } catch (err) {
    console.error("Media proxy failed", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
