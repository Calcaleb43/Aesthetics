"use client";

import { useCallback, useEffect, useState } from "react";

export type MediaItem = {
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

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (items: MediaItem[]) => void;
  multiple?: boolean;
  title?: string;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  title = "Media library",
}: MediaPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/media${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load media");
        setItems([]);
        return;
      }
      setItems(data.items || []);
      setUploadEnabled(Boolean(data.uploadEnabled));
    } catch {
      setError("Could not load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setQ("");
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => load(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q, open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (multiple) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("file", file);
        body.set("label", file.name.replace(/\.[^.]+$/, ""));
        const res = await fetch("/api/admin/media/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Upload failed");
          break;
        }
        if (!multiple) {
          onSelect([data as MediaItem]);
          onClose();
          setUploading(false);
          return;
        }
      }
      await load(q.trim());
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function confirm() {
    const chosen = items.filter((item) => selected.has(item.id));
    if (!chosen.length) return;
    onSelect(chosen);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg text-white">{title}</h2>
            <p className="text-xs text-white/45">
              {multiple ? "Select one or more images" : "Select an image"}
              {uploadEnabled ? " · upload enabled" : " · paste URLs in Media if uploads are off"}
            </p>
          </div>
          <button type="button" className="text-sm text-white/55 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search label, alt, or URL…"
            className="admin-input min-w-[14rem] flex-1"
          />
          {uploadEnabled ? (
            <label className="admin-btn cursor-pointer">
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                multiple={multiple}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  onUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>

        {error ? <p className="px-5 pt-3 text-sm text-red-300">{error}</p> : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? <p className="text-sm text-white/45">Loading…</p> : null}
          {!loading && !items.length ? (
            <p className="text-sm text-white/45">No media found. Upload an image or add a URL in Media.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const active = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    active ? "border-[#c6a75e] ring-1 ring-[#c6a75e]" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="aspect-[4/3] bg-black/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.alt || item.label || "Media"} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm text-white">{item.label || "Untitled"}</p>
                    <p className="truncate text-[0.65rem] text-white/40">
                      {[item.contentType?.replace("image/", ""), formatBytes(item.bytes)].filter(Boolean).join(" · ") ||
                        "External URL"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <p className="text-xs text-white/45">
            {selected.size ? `${selected.size} selected` : "Nothing selected"}
          </p>
          <div className="flex gap-2">
            <button type="button" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="admin-btn" disabled={!selected.size} onClick={confirm}>
              Use selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
