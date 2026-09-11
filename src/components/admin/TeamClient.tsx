"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { WeeklyHoursEditor } from "@/components/admin/WeeklyHoursEditor";
import { ADMIN_ROLES, type AdminRole } from "@/lib/auth/roles";
import type { WeeklyHours } from "@/lib/booking/money";

type ServiceOption = { id: string; title: string; slug: string };

type Member = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  color: string;
  phone: string | null;
  weeklyHours: WeeklyHours | null;
  serviceIds: string[];
  services: ServiceOption[];
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "staff" as AdminRole,
  color: "#c6a75e",
  serviceIds: [] as string[],
  active: true,
  weeklyHours: null as WeeklyHours | null,
};

export function TeamClient({ services }: { services: ServiceOption[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    role: "staff" as AdminRole,
    color: "#c6a75e",
    password: "",
    active: true,
    serviceIds: [] as string[],
    weeklyHours: null as WeeklyHours | null,
  });

  function load() {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/admin/team");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load team");
        return;
      }
      setMembers(data.members || []);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleService(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        color: form.color,
        serviceIds: form.serviceIds,
        active: form.active,
        weeklyHours: form.weeklyHours,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create member");
      return;
    }
    setForm(emptyForm);
    setStatus("Member created");
    load();
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEdit({
      name: m.name,
      role: m.role,
      color: m.color || "#c6a75e",
      password: "",
      active: m.active,
      serviceIds: [...m.serviceIds],
      weeklyHours: m.weeklyHours ? structuredClone(m.weeklyHours) : null,
    });
    setStatus("");
    setError("");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setStatus("");
    setError("");
    const body: Record<string, unknown> = {
      id: editingId,
      name: edit.name,
      role: edit.role,
      color: edit.color,
      active: edit.active,
      serviceIds: edit.serviceIds,
      weeklyHours: edit.weeklyHours,
    };
    if (edit.password) body.password = edit.password;

    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not update member");
      return;
    }
    setEditingId(null);
    setStatus("Member updated");
    load();
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setError("");
    const res = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not delete member");
      return;
    }
    if (editingId === id) setEditingId(null);
    setStatus("Member deleted");
    load();
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {status ? <p className="text-sm text-white/50">{status}</p> : null}

      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Add team member</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-white/70">
            Name
            <input
              className="admin-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm text-white/70">
            Email
            <input
              type="email"
              className="admin-input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-sm text-white/70">
            Password
            <input
              type="password"
              className="admin-input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-1 text-sm text-white/70">
            Role
            <select
              className="admin-input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-white/70">
            Color
            <input
              type="color"
              className="admin-input !h-11 !p-1"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm text-white/70">Assigned services</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const on = form.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, serviceIds: toggleService(f.serviceIds, s.id) }))
                    }
                    className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                      on ? "admin-chip-active" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
              {!services.length ? <p className="text-sm text-white/40">No services available.</p> : null}
            </div>
          </fieldset>
          <WeeklyHoursEditor
            value={form.weeklyHours}
            onChange={(weeklyHours) => setForm((f) => ({ ...f, weeklyHours }))}
          />
          <button type="submit" className="admin-btn w-fit">
            Create member
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Team</h2>
        {pending && !members.length ? <p className="text-sm text-white/50">Loading…</p> : null}
        {members.map((m) => (
          <article key={m.id} className="admin-card p-5">
            {editingId === m.id ? (
              <form onSubmit={onSaveEdit} className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm text-white/70">
                  Name
                  <input
                    className="admin-input"
                    value={edit.name}
                    onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Role
                  <select
                    className="admin-input"
                    value={edit.role}
                    onChange={(e) => setEdit((f) => ({ ...f, role: e.target.value as AdminRole }))}
                  >
                    {ADMIN_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Color
                  <input
                    type="color"
                    className="admin-input !h-11 !p-1"
                    value={edit.color}
                    onChange={(e) => setEdit((f) => ({ ...f, color: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  New password (optional)
                  <input
                    type="password"
                    className="admin-input"
                    value={edit.password}
                    onChange={(e) => setEdit((f) => ({ ...f, password: e.target.value }))}
                    minLength={8}
                    placeholder="Leave blank to keep"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={edit.active}
                    onChange={(e) => setEdit((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Active
                </label>
                <fieldset className="md:col-span-2">
                  <legend className="mb-2 text-sm text-white/70">Assigned services</legend>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => {
                      const on = edit.serviceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setEdit((f) => ({
                              ...f,
                              serviceIds: toggleService(f.serviceIds, s.id),
                            }))
                          }
                          className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                            on ? "admin-chip-active" : "bg-white/10 text-white/70"
                          }`}
                        >
                          {s.title}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <WeeklyHoursEditor
                  value={edit.weeklyHours}
                  onChange={(weeklyHours) => setEdit((f) => ({ ...f, weeklyHours }))}
                />
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="submit" className="admin-btn w-fit">
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
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20"
                    style={{ background: m.color || "#c6a75e" }}
                    title={m.color}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-sm text-white/50">{m.email}</p>
                    <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                      {m.role}
                      {!m.active ? " · inactive" : ""}
                    </p>
                    <p className="mt-2 text-sm text-white/55">
                      {m.services.length
                        ? m.services.map((s) => s.title).join(" · ")
                        : "No services assigned"}
                    </p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                      {m.weeklyHours ? "Custom weekly hours" : "Studio weekly hours"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                    onClick={() => startEdit(m)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:border-red-300/40 hover:text-red-200"
                    onClick={() => onDelete(m.id, m.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {!members.length && !pending ? <p className="text-sm text-white/50">No team members yet.</p> : null}
      </div>
    </div>
  );
}
