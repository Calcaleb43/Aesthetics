"use client";

import { FormEvent, useEffect, useState } from "react";

type Block = { id: string; startsAt: string; endsAt: string; reason: string };

export function BlockedTimesClient() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/blocked-times");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setBlocks(data.blocks || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    const res = await fetch("/api/admin/blocked-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason,
      }),
    });
    if (!res.ok) {
      setStatus("Could not add block");
      return;
    }
    setStartsAt("");
    setEndsAt("");
    setReason("");
    setStatus("Block added");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/admin/blocked-times", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="admin-card mt-8 p-6">
      <h2 className="text-lg font-semibold text-white">Blocked times</h2>
      <p className="mt-1 text-sm text-white/50">Vacations or closed hours that should not accept bookings.</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-white/70">
          Starts
          <input
            type="datetime-local"
            className="admin-input"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-white/70">
          Ends
          <input
            type="datetime-local"
            className="admin-input"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-white/70 md:col-span-2">
          Reason
          <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="submit" className="admin-btn w-fit">
          Add block
        </button>
        {status ? <p className="text-sm text-white/50 md:col-span-2">{status}</p> : null}
      </form>
      <ul className="mt-6 space-y-2">
        {blocks.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-3 text-sm">
            <span className="text-white/75">
              {new Date(b.startsAt).toLocaleString("en-CA")} → {new Date(b.endsAt).toLocaleString("en-CA")}
              {b.reason ? ` · ${b.reason}` : ""}
            </span>
            <button
              type="button"
              className="text-xs uppercase tracking-[0.12em] text-white/45 hover:text-red-200"
              onClick={() => remove(b.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {!blocks.length ? <li className="text-sm text-white/40">No blocked times.</li> : null}
      </ul>
    </div>
  );
}
