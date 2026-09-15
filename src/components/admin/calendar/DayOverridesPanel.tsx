"use client";

import { FormEvent, useEffect, useState } from "react";

type OverrideItem = {
  id: string;
  date: string;
  staffId: string | null;
  closed: boolean;
  windows: { start: string; end: string }[];
  note: string;
};

type StaffOption = { id: string; name: string };

export function DayOverridesPanel({
  canWrite = true,
  canManageAll = false,
  staff = [],
}: {
  canWrite?: boolean;
  canManageAll?: boolean;
  staff?: StaffOption[];
}) {
  const [rows, setRows] = useState<OverrideItem[]>([]);
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(false);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/day-overrides");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Could not load day edits");
        return;
      }
      setRows(
        (data.overrides || []).map((r: OverrideItem & { windows: unknown }) => ({
          ...r,
          windows: Array.isArray(r.windows) ? (r.windows as { start: string; end: string }[]) : [],
        })),
      );
    } catch {
      setStatus("Could not load day edits");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setStatus("");
    const res = await fetch("/api/admin/day-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        closed,
        windows: closed ? [] : [{ start, end }],
        note,
        staffId: canManageAll && staffId ? staffId : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus("Could not save day edit");
      return;
    }
    setModalOpen(false);
    setStatus("Day hours saved");
    await load();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    await fetch("/api/admin/day-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStatus("Day edit removed");
    await load();
  }

  return (
    <div className="admin-card mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Day hours</h2>
          <p className="mt-1 text-sm text-white/50">
            Override a single calendar day — close it or set custom open hours for booking.
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="admin-btn" onClick={() => setModalOpen(true)}>
            Edit a day
          </button>
        ) : null}
      </div>
      {status ? <p className="mt-3 text-sm text-white/55">{status}</p> : null}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-white">{r.date}</p>
              <p className="text-white/50">
                {r.closed
                  ? "Closed"
                  : r.windows.map((w) => `${w.start}–${w.end}`).join(", ") || "Custom hours"}
                {r.staffId ? " · staff-specific" : " · studio-wide"}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            {canWrite ? (
              <button type="button" className="text-xs uppercase tracking-[0.12em] text-red-300" onClick={() => remove(r.id)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {!rows.length ? <p className="text-sm text-white/45">No day overrides yet.</p> : null}
      </ul>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModalOpen(false)}>
          <form
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <h3 className="text-lg font-semibold text-white">Edit day hours</h3>
            <label className="mt-4 grid gap-1 text-sm text-white/70">
              Date
              <input
                type="date"
                required
                className="admin-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {canManageAll && staff.length ? (
              <label className="mt-3 grid gap-1 text-sm text-white/70">
                Scope
                <select className="admin-input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">Whole studio</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} only
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
              Closed all day
            </label>
            {!closed ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-white/70">
                  Opens
                  <input className="admin-input" value={start} onChange={(e) => setStart(e.target.value)} placeholder="10:00" />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Closes
                  <input className="admin-input" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="18:00" />
                </label>
              </div>
            ) : null}
            <label className="mt-3 grid gap-1 text-sm text-white/70">
              Note
              <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="mt-5 flex gap-3">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="admin-btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
