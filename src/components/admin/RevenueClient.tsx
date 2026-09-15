"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCad } from "@/lib/booking/money";
import {
  EXPENSE_CATEGORIES,
  type RevenueReport,
} from "@/lib/accounting/revenue";

type StaffOption = { id: string; name: string };

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "mtd", label: "Month to date" },
  { id: "ytd", label: "Year to date" },
  { id: "custom", label: "Custom" },
] as const;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-card p-5">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: { key: string; label: string; totalCents: number; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.totalCents)));
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">{title}</h3>
      {!items.length ? <p className="mt-4 text-sm text-white/40">No data in range</p> : null}
      <ul className="mt-4 space-y-3">
        {items.slice(0, 8).map((item) => (
          <li key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-white/85">{item.label}</span>
              <span className="shrink-0 text-white/60">
                {formatCad(item.totalCents)} · {item.count}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#c6a75e]"
                style={{ width: `${Math.min(100, (Math.abs(item.totalCents) / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RevenueClient() {
  const [preset, setPreset] = useState<string>("30d");
  const [basis, setBasis] = useState<"cash" | "accrual">("cash");
  const [staffId, setStaffId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"overview" | "ledger" | "expenses" | "adjust">("overview");

  const [adjType, setAdjType] = useState("offline_payment");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjTax, setAdjTax] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjEmail, setAdjEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const [expCategory, setExpCategory] = useState<string>("supplies");
  const [expAmount, setExpAmount] = useState("");
  const [expTax, setExpTax] = useState("");
  const [expVendor, setExpVendor] = useState("");
  const [expNote, setExpNote] = useState("");
  const [expDate, setExpDate] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        preset,
        basis,
      });
      if (staffId) params.set("staffId", staffId);
      if (preset === "custom") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const res = await fetch(`/api/admin/revenue?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load revenue");
        return;
      }
      setReport(data.report);
      setStaff(data.staff || []);
    } catch {
      setError("Could not load revenue");
    } finally {
      setLoading(false);
    }
  }, [preset, basis, staffId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDay = useMemo(
    () => Math.max(1, ...(report?.byDay.map((d) => Math.abs(d.totalCents)) || [1])),
    [report],
  );

  const expenseRows = useMemo(
    () => report?.ledger.filter((r) => r.kind === "expense") || [],
    [report],
  );

  async function exportCsv() {
    const params = new URLSearchParams({ preset, basis, format: "csv" });
    if (staffId) params.set("staffId", staffId);
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    window.location.href = `/api/admin/revenue?${params}`;
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: adjType,
        amount: Number(adjAmount),
        tax: adjTax === "" ? 0 : Number(adjTax),
        note: adjNote,
        clientEmail: adjEmail || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not post adjustment");
      return;
    }
    setStatus("Adjustment posted");
    setAdjAmount("");
    setAdjTax("");
    setAdjNote("");
    setAdjEmail("");
    setTab("ledger");
    await load();
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setSavingExpense(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "expense",
        category: expCategory,
        amount: Number(expAmount),
        tax: expTax === "" ? 0 : Number(expTax),
        vendor: expVendor || undefined,
        note: expNote || undefined,
        occurredAt: expDate ? new Date(`${expDate}T12:00:00`).toISOString() : undefined,
      }),
    });
    setSavingExpense(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not post expense");
      return;
    }
    setStatus("Expense recorded");
    setExpAmount("");
    setExpTax("");
    setExpVendor("");
    setExpNote("");
    setExpDate("");
    await load();
  }

  async function deleteExpense(ledgerId: string) {
    const id = ledgerId.replace(/^exp-/, "");
    if (!window.confirm("Delete this expense?")) return;
    setError("");
    const res = await fetch("/api/admin/revenue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind: "expense" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not delete expense");
      return;
    }
    setStatus("Expense deleted");
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-2 text-[0.62rem] uppercase tracking-[0.14em] text-white/40">Range</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] ${
                  preset === p.id ? "admin-chip-active" : "bg-white/10 text-white/65"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[0.62rem] uppercase tracking-[0.14em] text-white/40">Basis</p>
          <div className="flex gap-2">
            {(
              [
                ["cash", "Cash (collected)"],
                ["accrual", "Accrual (service date)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBasis(id)}
                className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] ${
                  basis === id ? "admin-chip-active" : "bg-white/10 text-white/65"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-1 text-xs text-white/55">
          Staff
          <select
            className="admin-input !py-2"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" ? (
          <>
            <label className="grid gap-1 text-xs text-white/55">
              From
              <input type="date" className="admin-input !py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-white/55">
              To
              <input type="date" className="admin-input !py-2" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        ) : null}
        <button type="button" className="admin-btn-secondary" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["ledger", "Ledger"],
            ["expenses", "Expenses"],
            ["adjust", "Adjustments"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-[0.68rem] uppercase tracking-[0.14em] ${
              tab === id ? "admin-chip-active" : "bg-white/10 text-white/65"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {status ? <p className="mb-4 text-sm text-[#c6a75e]">{status}</p> : null}
      {loading || !report ? (
        <p className="text-sm text-white/50">Loading revenue…</p>
      ) : (
        <>
          {tab === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Collected"
                  value={formatCad(report.summary.collectedCents)}
                  hint={`${report.summary.appointmentCount} appts · ${report.summary.packageCount} packages`}
                />
                <Kpi
                  label="Expenses"
                  value={formatCad(report.summary.expenseCents)}
                  hint={`${report.summary.expenseCount} entries · tax ${formatCad(report.summary.expenseTaxCents)}`}
                />
                <Kpi
                  label="Profit"
                  value={formatCad(report.summary.profitCents)}
                  hint="Collected minus expenses"
                />
                <Kpi
                  label="Outstanding"
                  value={formatCad(report.summary.outstandingCents)}
                  hint={`Pending holds ${formatCad(report.summary.pendingPaymentCents)}`}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Tax collected" value={formatCad(report.summary.taxCents)} hint="HST portion of charges" />
                <Kpi
                  label="Net (ex-tax)"
                  value={formatCad(report.summary.netExTaxCents)}
                  hint={`Discounts ${formatCad(report.summary.discountCents)}`}
                />
                <Kpi label="Package sales" value={formatCad(report.summary.packageSalesCents)} />
                <Kpi label="Refunds / write-offs" value={formatCad(report.summary.refundCents)} />
              </div>

              <div className="admin-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
                  Daily net (revenue − expenses)
                </h3>
                <div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto">
                  {report.byDay.map((d) => (
                    <div key={d.date} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full rounded-t ${d.totalCents < 0 ? "bg-red-400/80" : "bg-[#c6a75e]/80"}`}
                        style={{
                          height: `${Math.max(2, (Math.abs(d.totalCents) / maxDay) * 100)}%`,
                          opacity: d.totalCents ? 1 : 0.15,
                        }}
                        title={`${d.date}: ${formatCad(d.totalCents)}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/40">
                  {report.byDay[0]?.date} → {report.byDay[report.byDay.length - 1]?.date} · {report.timezone}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <BreakdownList title="By staff" items={report.byStaff} />
                <BreakdownList title="By category" items={report.byCategory} />
                <BreakdownList title="By payment type" items={report.byPaymentMode} />
                <BreakdownList title="Expenses by category" items={report.byExpenseCategory} />
              </div>
            </div>
          ) : null}

          {tab === "ledger" ? (
            <div className="admin-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[0.62rem] uppercase tracking-[0.14em] text-white/40">
                    <tr>
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Client / vendor</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                      <th className="px-4 py-3 font-medium text-right">Balance due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.ledger.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 text-white/80">
                        <td className="whitespace-nowrap px-4 py-3 text-white/55">
                          {new Date(row.occurredAt).toLocaleString("en-CA", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 capitalize">{row.typeLabel}</td>
                        <td className="px-4 py-3">
                          <span className="block">{row.clientName}</span>
                          <span className="text-xs text-white/40">{row.clientEmail}</span>
                        </td>
                        <td className="max-w-[14rem] truncate px-4 py-3">{row.description}</td>
                        <td className="px-4 py-3 text-white/55">{row.staffName || "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium ${row.totalCents < 0 ? "text-red-300" : ""}`}>
                          {formatCad(row.totalCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-white/55">
                          {row.balanceDueCents ? formatCad(row.balanceDueCents) : "—"}
                        </td>
                      </tr>
                    ))}
                    {!report.ledger.length ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                          No ledger rows in this range
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "expenses" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
              <form className="admin-card space-y-4 p-6" onSubmit={submitExpense}>
                <h3 className="text-lg font-semibold text-white">Record expense</h3>
                <p className="text-sm text-white/50">
                  Track rent, supplies, payroll, and other studio costs. Amounts are stored as money out.
                </p>
                <label className="grid gap-1 text-sm text-white/70">
                  Category
                  <select
                    className="admin-input"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm text-white/70">
                    Amount (CAD)
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="admin-input"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-white/70">
                    Tax (CAD)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="admin-input"
                      value={expTax}
                      onChange={(e) => setExpTax(e.target.value)}
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm text-white/70">
                  Vendor
                  <input
                    className="admin-input"
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Date
                  <input
                    type="date"
                    className="admin-input"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Note
                  <textarea
                    className="admin-input"
                    rows={3}
                    value={expNote}
                    onChange={(e) => setExpNote(e.target.value)}
                  />
                </label>
                <button type="submit" className="admin-btn" disabled={savingExpense}>
                  {savingExpense ? "Saving…" : "Save expense"}
                </button>
              </form>

              <div className="space-y-4">
                <BreakdownList title="By category (range)" items={report.byExpenseCategory} />
                <div className="admin-card overflow-hidden">
                  <div className="border-b border-white/10 px-4 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
                      Expenses in range
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-white/10 text-[0.62rem] uppercase tracking-[0.14em] text-white/40">
                        <tr>
                          <th className="px-4 py-3 font-medium">When</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Vendor</th>
                          <th className="px-4 py-3 font-medium">Note</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                          <th className="px-4 py-3 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {expenseRows.map((row) => (
                          <tr key={row.id} className="border-b border-white/5 text-white/80">
                            <td className="whitespace-nowrap px-4 py-3 text-white/55">
                              {new Date(row.occurredAt).toLocaleDateString("en-CA", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3 capitalize">
                              {(row.expenseCategory || "").replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3">{row.clientName}</td>
                            <td className="max-w-[12rem] truncate px-4 py-3 text-white/55">{row.description}</td>
                            <td className="px-4 py-3 text-right font-medium text-red-300">
                              {formatCad(Math.abs(row.totalCents))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className="text-xs uppercase tracking-[0.12em] text-white/40 hover:text-red-300"
                                onClick={() => void deleteExpense(row.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!expenseRows.length ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                              No expenses in this range
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "adjust" ? (
            <form className="admin-card max-w-xl space-y-4 p-6" onSubmit={submitAdjustment}>
              <h3 className="text-lg font-semibold text-white">Post adjustment</h3>
              <p className="text-sm text-white/50">
                Record refunds, offline cash/e-transfer, or write-offs. Refunds and write-offs are stored as negative
                amounts.
              </p>
              <label className="grid gap-1 text-sm text-white/70">
                Type
                <select className="admin-input" value={adjType} onChange={(e) => setAdjType(e.target.value)}>
                  <option value="offline_payment">Offline payment</option>
                  <option value="refund">Refund</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="write_off">Write-off</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-white/70">
                  Amount (CAD)
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="admin-input"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Tax (CAD)
                  <input
                    type="number"
                    step="0.01"
                    className="admin-input"
                    value={adjTax}
                    onChange={(e) => setAdjTax(e.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm text-white/70">
                Client email (optional)
                <input
                  type="email"
                  className="admin-input"
                  value={adjEmail}
                  onChange={(e) => setAdjEmail(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Note
                <textarea className="admin-input" rows={3} value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
              </label>
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? "Posting…" : "Post entry"}
              </button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
