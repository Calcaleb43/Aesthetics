"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AppointmentRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  serviceTitle: string;
  serviceLabel: string | null;
  priceLabel: string;
  amountLabel: string;
  notes: string;
};

type ClientDetail = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  notes: string;
  banned: boolean;
  appointments: AppointmentRow[];
};

export function ClientsDetailClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    banned: false,
  });

  async function load() {
    setError("");
    const res = await fetch(`/api/admin/clients?id=${encodeURIComponent(clientId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load client");
      return;
    }
    const c = data.client as ClientDetail;
    setClient(c);
    setEdit({
      name: c.name,
      email: c.email,
      phone: c.phone || "",
      notes: c.notes || "",
      banned: Boolean(c.banned),
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clientId, ...edit }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setStatus("Saved");
    load();
  }

  async function onDelete() {
    if (!confirm("Delete this client record? Appointments stay unlinked.")) return;
    const res = await fetch("/api/admin/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clientId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    router.push("/admin/clients");
  }

  if (!client && !error) {
    return <p className="text-sm text-white/50">Loading client…</p>;
  }

  if (!client) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/clients" className="text-sm text-white/50 underline hover:text-white">
          ← Clients
        </Link>
        <Link
          href={`/admin/appointments?clientId=${client.id}`}
          className="rounded-full border border-[#c6a75e]/40 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] transition hover:bg-[#c6a75e]/10"
        >
          Book appointment
        </Link>
        {client.banned ? (
          <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-rose-200">
            Banned
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}

      <form onSubmit={onSave} className="admin-card grid gap-3 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-white">Profile</h2>
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
          Email
          <input
            type="email"
            className="admin-input"
            value={edit.email}
            onChange={(e) => setEdit((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-white/70">
          Phone
          <input
            className="admin-input"
            value={edit.phone}
            onChange={(e) => setEdit((f) => ({ ...f, phone: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-white/70 md:pt-6">
          <input
            type="checkbox"
            checked={edit.banned}
            onChange={(e) => setEdit((f) => ({ ...f, banned: e.target.checked }))}
          />
          Mark as banned / do not book
        </label>
        <label className="grid gap-1 text-sm text-white/70 md:col-span-2">
          Notes
          <textarea
            className="admin-input"
            rows={5}
            value={edit.notes}
            onChange={(e) => setEdit((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className="admin-btn" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="rounded-full border border-rose-400/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-rose-200"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </form>

      <div className="admin-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Visit history ({client.appointments.length})
        </h2>
        {client.appointments.length === 0 ? (
          <p className="text-sm text-white/45">No appointments yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {client.appointments.map((a) => (
              <li key={a.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{a.serviceTitle}</p>
                    <p className="text-sm text-white/55">
                      {new Date(a.startsAt).toLocaleString("en-CA", {
                        timeZone: "America/Toronto",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                      {a.status.replace(/_/g, " ")} · {a.priceLabel}
                      {a.amountLabel !== a.priceLabel ? ` · paid ${a.amountLabel}` : ""}
                    </p>
                  </div>
                  <Link
                    href="/admin/appointments"
                    className="text-[0.65rem] uppercase tracking-[0.12em] text-white/40 underline"
                  >
                    Calendar
                  </Link>
                </div>
                {a.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/45 line-clamp-4">{a.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
