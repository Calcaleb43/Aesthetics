"use client";

import { FormEvent, useEffect, useState } from "react";

export type BlockedTimeItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  staffId: string | null;
  staffName: string | null;
};

type StaffOption = { id: string; name: string };

export function BlockedTimesPanel({
  canWrite = true,
  canManageAll = false,
  staff = [],
  onChanged,
}: {
  canWrite?: boolean;
  canManageAll?: boolean;
  staff?: StaffOption[];
  onChanged?: (blocks: BlockedTimeItem[]) => void;
}) {
  const [blocks, setBlocks] = useState<BlockedTimeItem[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/blocked-times");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Could not load blocks");
        return;
      }
      const next = (data.blocks || []) as BlockedTimeItem[];
      setBlocks(next);
      onChanged?.(next);
    } catch {
      setStatus("Could not load blocks");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function openModal() {
    setStartsAt("");
    setEndsAt("");
    setReason("");
    setStaffId("");
    setStatus("");
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setStatus("");
    setSaving(true);
    const res = await fetch("/api/admin/blocked-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason,
        staffId: canManageAll && staffId ? staffId : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus("Could not add block");
      return;
    }
    setModalOpen(false);
    setStatus("Block added");
    await load();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    await fetch("/api/admin/blocked-times", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStatus("Block removed");
    await load();
  }

  return (
    <div className="admin-card mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Blocked times</h2>
          <p className="mt-1 text-sm text-white/50">
            Vacations or closed hours — shown on the calendar and closed to public booking.
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="admin-btn" onClick={openModal}>
            Add block
          </button>
        ) : null}
      </div>

      {!canWrite ? (
        <p className="mt-4 text-sm text-white/45">View only — you cannot edit blocked times.</p>
      ) : null}
      {status ? <p className="mt-3 text-sm text-white/50">{status}</p> : null}

      <ul className="mt-6 space-y-2">
        {blocks.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-3 text-sm"
          >
            <span className="text-white/75">
              {new Date(b.startsAt).toLocaleString("en-CA")} → {new Date(b.endsAt).toLocaleString("en-CA")}
              {b.staffName ? ` · ${b.staffName}` : " · Studio"}
              {b.reason ? ` · ${b.reason}` : ""}
            </span>
            {canWrite ? (
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/45 hover:text-red-200"
                onClick={() => remove(b.id)}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {!blocks.length ? <li className="text-sm text-white/40">No blocked times.</li> : null}
      </ul>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-block-title"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="add-block-title" className="text-lg font-semibold text-white">
                Add blocked time
              </h3>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/50 hover:text-white"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>
            {status && modalOpen ? <p className="mb-3 text-sm text-rose-300">{status}</p> : null}
            <form onSubmit={onSubmit} className="grid gap-3">
              <label className="grid gap-1 text-sm text-white/70">
                Starts
                <input
                  type="datetime-local"
                  className="admin-input"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  autoFocus
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
              {canManageAll && staff.length ? (
                <label className="grid gap-1 text-sm text-white/70">
                  Staff (optional — leave blank for studio-wide)
                  <select className="admin-input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                    <option value="">Studio-wide</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1 text-sm text-white/70">
                Reason
                <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="submit" className="admin-btn" disabled={saving}>
                  {saving ? "Saving…" : "Add block"}
                </button>
                <button type="button" className="admin-btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
