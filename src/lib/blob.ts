import type { BlobAccessType } from "@vercel/blob";

/**
 * Vercel Blob store access mode. Must match the store created in the Vercel dashboard.
 * Private stores reject `access: "public"` uploads.
 */
export function getBlobAccess(): BlobAccessType {
  const raw = (process.env.BLOB_ACCESS || "private").trim().toLowerCase();
  return raw === "public" ? "public" : "private";
}

export function isPrivateBlobUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.includes(".private.blob.");
  } catch {
    return false;
  }
}

/** Site-facing URL for a media library asset (proxy when the blob store is private). */
export function mediaAssetPublicPath(id: string) {
  return `/api/media/${id}`;
}
