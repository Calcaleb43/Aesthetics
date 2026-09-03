"use client";

import { useEffect, useState, useTransition } from "react";

type AppointmentRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  notes: string;
  paymentMode: string;
  amountLabel: string;
  priceLabel: string;
  serviceTitle: string;
};

const FILTERS = ["upcoming", "all", "confirmed", "pending_payment", "completed", "cancelled", "no_show"] as const;

export function AppointmentsClient() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("upcoming");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError("");
      const params = new URLSearchParams();
      if (filter === "upcoming") {
        params.set("from", new Date().toISOString());
        params.set("status", "confirmed");
      } else if (filter !== "all") {
        params.set("status", filter);
      }
      const res = await fetch(`/api/admin/appointments?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setRows(data.appointments || []);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      setError("Could not update appointment");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
              filter === key ? "admin-chip-active" : "bg-white/10 text-white/70"
            }`}
          >
            {key.replace("_", " ")}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {pending && !rows.length ? <p className="text-sm text-white/50">Loading…</p> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="admin-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.serviceTitle}</p>
                <p className="mt-1 text-sm text-white/70">
                  {new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Toronto",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.startsAt))}
                </p>
                <p className="mt-2 text-sm text-white/80">{row.clientName}</p>
                <p className="text-sm text-white/50">
                  <a href={`mailto:${row.clientEmail}`} className="underline">
                    {row.clientEmail}
                  </a>
                  {row.clientPhone ? ` · ${row.clientPhone}` : ""}
                </p>
                {row.notes ? <p className="mt-2 text-sm text-white/45">{row.notes}</p> : null}
              </div>
              <div className="text-right text-xs uppercase tracking-[0.12em] text-white/45">
                <p>{row.status.replace("_", " ")}</p>
                <p className="mt-1 normal-case tracking-normal text-white/70">
                  Charged {row.amountLabel}
                  <span className="text-white/40"> · service {row.priceLabel}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {row.status !== "completed" ? (
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                  onClick={() => setStatus(row.id, "completed")}
                >
                  Complete
                </button>
              ) : null}
              {row.status !== "cancelled" ? (
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                  onClick={() => setStatus(row.id, "cancelled")}
                >
                  Cancel
                </button>
              ) : null}
              {row.status !== "no_show" ? (
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                  onClick={() => setStatus(row.id, "no_show")}
                >
                  No-show
                </button>
              ) : null}
              {row.status === "pending_payment" || row.status === "expired" ? (
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                  onClick={() => setStatus(row.id, "confirmed")}
                >
                  Mark confirmed
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!rows.length && !pending ? <p className="text-sm text-white/50">No appointments in this view.</p> : null}
      </div>
    </div>
  );
}
