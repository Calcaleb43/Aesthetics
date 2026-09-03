"use client";

import { FormEvent, useEffect, useState } from "react";

type Media = { id: string; url: string; alt: string; label: string; createdAt?: string };

export default function AdminMediaClient() {
  const [items, setItems] = useState<Media[]>([]);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/media");
    if (res.ok) setItems(await res.json());
    else setStatus({ tone: "err", text: "Could not load media — connect Neon and sign in." });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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
    setStatus({ tone: "ok", text: "Media added" });
    e.currentTarget.reset();
    load();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Remove this media asset?")) return;
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
    load();
  }

  async function copyUrl(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <form onSubmit={onSubmit} className="admin-card grid h-fit gap-3 p-5">
        <h2 className="text-lg">Add image</h2>
        <p className="text-xs text-white/45">Paste a hosted image URL (Squarespace CDN, Cloudinary, etc.).</p>
        <input name="url" required placeholder="https://..." className="admin-input" />
        <input name="label" placeholder="Label" className="admin-input" />
        <input name="alt" placeholder="Alt text" className="admin-input" />
        <button type="submit" className="admin-btn mt-2 w-fit">
          Add media
        </button>
        {status.text ? (
          <p className={`text-sm ${status.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{status.text}</p>
        ) : null}
      </form>

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
                <p className="font-medium">{item.label || "Untitled"}</p>
                <p className="truncate text-xs text-white/45">{item.url}</p>
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
                    onClick={() => onDelete(item.id)}
                    className="rounded-full border border-red-400/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        {!loading && !items.length && (
          <div className="admin-card p-6 sm:col-span-2 xl:col-span-3">
            <p className="text-sm text-white/50">No media assets yet. Add image URLs to reuse across pages and services.</p>
          </div>
        )}
      </div>
    </div>
  );
}
