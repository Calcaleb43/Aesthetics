"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";

type PendingPayment = {
  id: string;
  status: string;
  startsAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  paymentMode: string;
  amountLabel: string;
  priceLabel: string;
  balanceDueCents: number;
  balanceDueLabel: string;
  serviceTitle: string;
  staffName: string | null;
};

type CollectMethod = "stripe" | "cash" | "etransfer" | "card";

const METHODS: { id: CollectMethod; label: string; hint: string }[] = [
  { id: "stripe", label: "Stripe link", hint: "Email/open a card checkout link" },
  { id: "cash", label: "Cash", hint: "Record cash received at studio" },
  { id: "etransfer", label: "E-transfer", hint: "Record Interac e-transfer" },
  { id: "card", label: "Card at studio", hint: "Record terminal / in-person card" },
];

function formatWhen(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function PendingPaymentsClient() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [totalLabel, setTotalLabel] = useState("$0.00");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState<CollectMethod>("cash");
  const [amountDollars, setAmountDollars] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/admin/payments");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load pending payments");
        return;
      }
      setPayments(data.payments || []);
      setTotalLabel(data.totalOutstandingLabel || "$0.00");
      setTimezone(data.timezone || "America/Toronto");
      setCanWrite(Boolean(data.canWrite));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => payments.find((p) => p.id === selectedId) || null,
    [payments, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.clientEmail.toLowerCase().includes(q) ||
        p.serviceTitle.toLowerCase().includes(q) ||
        (p.staffName || "").toLowerCase().includes(q),
    );
  }, [payments, query]);

  function openCollect(row: PendingPayment) {
    setSelectedId(row.id);
    setMethod("cash");
    setAmountDollars((row.balanceDueCents / 100).toFixed(2));
    setNote("");
    setError("");
  }

  function closeCollect() {
    setSelectedId(null);
    setAmountDollars("");
    setNote("");
  }

  async function submitCollect(e: FormEvent) {
    e.preventDefault();
    if (!selected || !canWrite) return;
    setBusyId(selected.id);
    setError("");

    const body: Record<string, unknown> = {
      id: selected.id,
      method,
    };
    if (method !== "stripe") {
      const dollars = Number(amountDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setError("Enter a valid amount");
        setBusyId(null);
        return;
      }
      body.amount = dollars;
      if (note.trim()) body.note = note.trim();
    }

    const res = await fetch("/api/admin/appointments/collect-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      setError(data.error || "Could not record payment");
      return;
    }

    if (method === "stripe" && data.checkoutUrl) {
      await navigator.clipboard?.writeText(data.checkoutUrl).catch(() => undefined);
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      alert(`Stripe balance link ready (also copied):\n${data.checkoutUrl}`);
      closeCollect();
      load();
      return;
    }

    alert(`Recorded ${data.collectedLabel || "payment"}. Remaining: ${data.remainingLabel || "$0.00"}`);
    closeCollect();
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/45">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold text-[#c6a75e]">{totalLabel}</p>
          <p className="mt-1 text-sm text-white/50">
            {payments.length} booking{payments.length === 1 ? "" : "s"} with a balance due
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="admin-input min-w-[14rem]"
            placeholder="Search client, service, staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="admin-btn-secondary" onClick={load} disabled={pending}>
            {pending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-4">
        {filtered.map((row) => (
          <article key={row.id} className="admin-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg text-white">{row.clientName}</h2>
                  <span className="rounded-full bg-[#c6a75e]/15 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                    {row.paymentMode === "none" ? "pay at studio" : "deposit balance"}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/50">
                    {row.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/65">{row.serviceTitle}</p>
                <p className="mt-1 text-sm text-white/50">{formatWhen(row.startsAt, timezone)}</p>
                <p className="mt-2 text-sm text-white/55">
                  <a href={`mailto:${row.clientEmail}`} className="transition hover:text-[#c6a75e]">
                    {row.clientEmail}
                  </a>
                  {row.clientPhone ? ` · ${row.clientPhone}` : ""}
                  {row.staffName ? ` · ${row.staffName}` : ""}
                </p>
                <p className="mt-2 text-xs text-white/40">
                  Paid {row.amountLabel} · service {row.priceLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/45">Due</p>
                <p className="mt-1 text-xl font-semibold text-[#c6a75e]">{row.balanceDueLabel}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {canWrite ? (
                    <button type="button" className="admin-btn" onClick={() => openCollect(row)}>
                      Receive payment
                    </button>
                  ) : null}
                  <Link
                    href="/admin/appointments"
                    className="admin-btn-secondary inline-flex items-center"
                  >
                    Calendar
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}

        {!filtered.length && !pending ? (
          <p className="text-sm text-white/50">
            {payments.length ? "No matches for that search." : "No pending balances right now."}
          </p>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={closeCollect}>
          <div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Receive payment</h3>
                <p className="mt-1 text-sm text-white/55">
                  {selected.clientName} · {selected.balanceDueLabel} due
                </p>
              </div>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/50 hover:text-white"
                onClick={closeCollect}
              >
                Close
              </button>
            </div>

            <form onSubmit={submitCollect} className="mt-5 grid gap-4">
              <fieldset className="grid gap-2">
                <legend className="text-sm text-white/70">Payment method</legend>
                <div className="grid gap-2">
                  {METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                        method === m.id
                          ? "border-[#c6a75e]/50 bg-[#c6a75e]/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        className="mt-1"
                        checked={method === m.id}
                        onChange={() => setMethod(m.id)}
                      />
                      <span>
                        <span className="block text-sm text-white">{m.label}</span>
                        <span className="block text-xs text-white/45">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {method !== "stripe" ? (
                <>
                  <label className="grid gap-1 text-sm text-white/70">
                    Amount (CAD)
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      className="admin-input"
                      value={amountDollars}
                      onChange={(e) => setAmountDollars(e.target.value)}
                      required
                    />
                    <span className="text-xs text-white/40">
                      Max {selected.balanceDueLabel}. Partial amounts are allowed.
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm text-white/70">
                    Note (optional)
                    <input
                      className="admin-input"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Reference #, last 4 digits…"
                      maxLength={500}
                    />
                  </label>
                </>
              ) : (
                <p className="text-sm text-white/50">
                  Creates a Stripe Checkout link for the full remaining balance (
                  {selected.balanceDueLabel}).
                </p>
              )}

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              <button type="submit" className="admin-btn w-fit" disabled={busyId === selected.id}>
                {busyId === selected.id
                  ? "Working…"
                  : method === "stripe"
                    ? "Create Stripe link"
                    : "Record payment"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
