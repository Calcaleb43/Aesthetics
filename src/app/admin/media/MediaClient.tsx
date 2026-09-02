"use client";

import { FormEvent, useEffect, useState } from "react";

type Media = { id: string; url: string; alt: string; label: string };

export default function AdminMediaClient() {
  const [items, setItems] = useState<Media[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const res = await fetch("/api/admin/media");
    if (res.ok) setItems(await res.json());
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
    setStatus(res.ok ? "Added" : "Failed — connect Neon to store media");
    if (res.ok) {
      e.currentTarget.reset();
      load();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="grid gap-3">
        <input name="url" required placeholder="Image URL" className="rounded border border-white/15 bg-black/30 px-3 py-2" />
        <input name="label" placeholder="Label" className="rounded border border-white/15 bg-black/30 px-3 py-2" />
        <input name="alt" placeholder="Alt text" className="rounded border border-white/15 bg-black/30 px-3 py-2" />
        <button type="submit" className="w-fit rounded-full bg-[#f5f1eb] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black">
          Add media
        </button>
        {status && <p className="text-sm text-white/60">{status}</p>}
      </form>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-white/10 p-3 text-sm">
            <p className="font-medium">{item.label || "Untitled"}</p>
            <p className="mt-1 break-all text-white/60">{item.url}</p>
          </div>
        ))}
        {!items.length && <p className="text-sm text-white/50">No media assets yet.</p>}
      </div>
    </div>
  );
}
