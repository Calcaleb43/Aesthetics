"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type ClientRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  notes: string;
  banned: boolean;
  appointmentCount: number;
  lastVisitAt: string | null;
  lastStatus: string | null;
};

const emptyForm = { name: "", email: "", phone: "", notes: "" };
const PAGE_SIZE = 25;

function formatVisitDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (nextPage: number, nextSearch: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      const res = await fetch(`/api/admin/clients?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load clients");
        return;
      }
      setClients(data.clients || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || nextPage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, "");
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function openModal() {
    setForm(emptyForm);
    setError("");
    setStatus("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
  }

  function runSearch() {
    setSearch(q);
    setPage(1);
    void load(1, q);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    setError("");
    setCreating(true);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create client");
      return;
    }
    setForm(emptyForm);
    setStatus("Client created");
    setModalOpen(false);
    void load(1, search);
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const atFirstPage = page <= 1;
  const atLastPage = page >= totalPages;

  return (
    <div className="space-y-6">
      <div className="admin-card p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Clients</h2>
          <input
            className="admin-input max-w-xs"
            placeholder="Search name, email, phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          <button type="button" className="admin-btn-secondary" onClick={runSearch} disabled={loading}>
            Search
          </button>
          <button type="button" className="admin-btn ml-auto" onClick={openModal}>
            Add client
          </button>
        </div>

        {error && !modalOpen ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
        {status ? <p className="mb-3 text-sm text-emerald-300">{status}</p> : null}

        <ul className="divide-y divide-white/10" aria-busy={loading}>
          {clients.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <Link href={`/admin/clients/${c.id}`} className="min-w-0 text-left hover:opacity-90">
                <p className="font-medium text-white">
                  {c.name}
                  {c.banned ? (
                    <span className="ml-2 text-[0.65rem] uppercase tracking-[0.12em] text-rose-300">
                      Banned
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-white/55">{c.email}</p>
                {c.phone ? <p className="text-sm text-white/45">{c.phone}</p> : null}
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/35">
                  {c.appointmentCount} visit{c.appointmentCount === 1 ? "" : "s"}
                  {c.lastVisitAt ? ` · last ${formatVisitDate(c.lastVisitAt)}` : ""}
                </p>
              </Link>
              <Link
                href={`/admin/appointments?clientId=${c.id}`}
                className="rounded-full border border-[#c6a75e]/40 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] transition hover:bg-[#c6a75e]/10"
              >
                Book
              </Link>
            </li>
          ))}
          {!loading && clients.length === 0 ? (
            <li className="py-6 text-sm text-white/45">No clients yet.</li>
          ) : null}
          {loading && clients.length === 0 ? (
            <li className="py-6 text-sm text-white/45">Loading clients…</li>
          ) : null}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-white/45">
            {total === 0 ? "0 clients" : `Showing ${from}–${to} of ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="admin-btn-secondary"
              disabled={atFirstPage || loading}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                void load(next, search);
              }}
            >
              Previous
            </button>
            <span className="text-sm text-white/55">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="admin-btn-secondary"
              disabled={atLastPage || loading}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(next, search);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-client-title"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="add-client-title" className="text-lg font-semibold text-white">
                Add client
              </h2>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/50 hover:text-white"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

            <form onSubmit={onCreate} className="grid gap-3">
              <label className="grid gap-1 text-sm text-white/70">
                Name
                <input
                  className="admin-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
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
                Phone
                <input
                  className="admin-input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Notes
                <textarea
                  className="admin-input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="submit" className="admin-btn" disabled={creating}>
                  {creating ? "Creating…" : "Create client"}
                </button>
                <button type="button" className="admin-btn-secondary" onClick={closeModal}>
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
