/**
 * Normalize pasted media URLs so they work in <img> tags.
 * Google Drive share links are converted to a direct-view form when possible.
 */
export function normalizeMediaUrl(raw: string): { url: string; note?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: trimmed };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: trimmed };
  }

  const host = parsed.hostname.toLowerCase();
  const isDrive =
    host === "drive.google.com" ||
    host === "docs.google.com" ||
    host.endsWith(".googleusercontent.com");

  if (!isDrive) return { url: trimmed };

  // Already a usable googleusercontent CDN URL
  if (host.endsWith(".googleusercontent.com")) {
    return { url: trimmed };
  }

  // Already a uc/export direct link
  if (parsed.pathname.includes("/uc") || parsed.searchParams.get("export") === "view") {
    const id = parsed.searchParams.get("id");
    if (id) {
      return {
        url: `https://drive.google.com/uc?export=view&id=${id}`,
        note: "Converted Google Drive link to a direct image URL. File must be shared as “Anyone with the link”.",
      };
    }
  }

  const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
  const openId = parsed.searchParams.get("id");
  const fileId = fileMatch?.[1] || openId;

  if (!fileId) {
    return {
      url: trimmed,
      note: "Could not find a Google Drive file id. Open the file, use Share → Anyone with the link, then copy the link again.",
    };
  }

  return {
    url: `https://drive.google.com/uc?export=view&id=${fileId}`,
    note: "Converted Google Drive share link to a direct image URL. File must be shared as “Anyone with the link”.",
  };
}
