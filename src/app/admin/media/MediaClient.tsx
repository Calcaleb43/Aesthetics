"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MediaItem } from "@/components/admin/MediaPicker";

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminMediaClient() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (query = q) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus({ tone: "err", text: typeof data.error === "string" ? data.error : "Could not load media" });
        setItems([]);
        return;
      }
      setItems(data.items || []);
      setUploadEnabled(Boolean(data.uploadEnabled));
    } catch {
      setStatus({ tone: "err", text: "Could not load media — connect Neon and sign in." });
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => load(q), 250);
    return () => window.clearTimeout(t);
  }, [q, load]);

  async function onPasteUrl(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: form.get("url"),
        alt: form.get("alt"),
        label: form.get("label"),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus({
        tone: "err",
        text: typeof body.error === "string" ? body.error : "Failed to add media",
      });
      return;
    }
    const body = await res.json().catch(() => ({}));
    setStatus({
      tone: "ok",
      text: typeof body.note === "string" ? body.note : "Media added",
    });
    e.currentTarget.reset();
    load(q);
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setStatus({ tone: "", text: "" });
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("file", file);
        body.set("label", file.name.replace(/\.[^.]+$/, ""));
        const res = await fetch("/api/admin/media/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setStatus({ tone: "err", text: typeof data.error === "string" ? data.error : "Upload failed" });
          break;
        }
      }
      setStatus({ tone: "ok", text: "Upload complete" });
      load(q);
    } catch {
      setStatus({ tone: "err", text: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Remove this media asset? Uploaded files will also be deleted from storage.")) return;
    const res = await fetch("/api/admin/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setStatus({ tone: "err", text: "Delete failed" });
      return;
    }
    setStatus({ tone: "ok", text: "Media removed" });
    load(q);
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label: editLabel, alt: editAlt }),
    });
    if (!res.ok) {
      setStatus({ tone: "err", text: "Could not update media" });
      return;
    }
    setEditingId(null);
    setStatus({ tone: "ok", text: "Media updated" });
    load(q);
  }

  async function copyUrl(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="grid h-fit gap-4">
        <div className="admin-card grid gap-3 p-5">
          <h2 className="text-lg">Upload</h2>
          {uploadEnabled ? (
            <>
              <p className="text-xs text-white/45">JPEG, PNG, WebP, GIF, or SVG up to 12MB.</p>
              <label className="admin-btn cursor-pointer justify-center">
                {uploading ? "Uploading…" : "Choose files"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    onUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          ) : (
            <p className="text-xs leading-5 text-amber-200/80">
              Set <code className="text-[#e8d5a3]">BLOB_READ_WRITE_TOKEN</code> to enable uploads (Vercel Blob). You can
              still paste external URLs below.
            </p>
          )}
        </div>

        <form onSubmit={onPasteUrl} className="admin-card grid gap-3 p-5">
          <h2 className="text-lg">Paste URL</h2>
          <p className="text-xs leading-5 text-white/45">
            Add a hosted image URL. Google Drive share links are converted automatically — file must be shared as{" "}
            <strong className="font-medium text-white/70">Anyone with the link</strong>.
          </p>
          <input name="url" required placeholder="https://drive.google.com/file/d/… or CDN URL" className="admin-input" />
          <input name="label" placeholder="Label" className="admin-input" />
          <input name="alt" placeholder="Alt text" className="admin-input" />
          <button type="submit" className="admin-btn mt-1 w-fit">
            Add URL
          </button>
        </form>

        {status.text ? (
          <p className={`text-sm ${status.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{status.text}</p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search media…"
          className="admin-input max-w-md"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading && <p className="text-sm text-white/45">Loading media…</p>}
          {!loading &&
            items.map((item) => (
              <article key={item.id} className="admin-card overflow-hidden">
                <div className="aspect-[4/3] bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.alt || item.label || "Media"} className="h-full w-full object-cover" />
                </div>
                <div className="grid gap-2 p-4">
                  {editingId === item.id ? (
                    <>
                      <input
                        className="admin-input"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                      />
                      <input
                        className="admin-input"
                        value={editAlt}
                        onChange={(e) => setEditAlt(e.target.value)}
                        placeholder="Alt text"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="admin-btn" onClick={() => saveEdit(item.id)}>
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{item.label || "Untitled"}</p>
                      {item.alt ? <p className="text-xs text-white/45">{item.alt}</p> : null}
                      <p className="truncate text-[0.65rem] text-white/35">{item.url}</p>
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-white/35">
                        {[item.pathname ? "Uploaded" : "External", item.contentType?.replace("image/", ""), formatBytes(item.bytes)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyUrl(item.id, item.url)}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                        >
                          {copiedId === item.id ? "Copied" : "Copy URL"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditLabel(item.label);
                            setEditAlt(item.alt);
                          }}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-full border border-red-400/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          {!loading && !items.length && (
            <div className="admin-card p-6 sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-white/50">
                No media yet. Upload images or paste hosted URLs to reuse across pages, categories, and settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
