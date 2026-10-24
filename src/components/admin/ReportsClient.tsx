"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCad } from "@/lib/booking/money";
import {
  formatPercentBps,
  formatReportRangeLabel,
  type CountItem,
  type StudioReport,
} from "@/lib/reporting/studio-report";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "mtd", label: "Month to date" },
  { id: "ytd", label: "Year to date" },
  { id: "custom", label: "Custom" },
] as const;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "Appointments" },
  { id: "clients", label: "Clients" },
  { id: "revenue", label: "Revenue" },
  { id: "marketing", label: "Marketing" },
  { id: "inquiries", label: "Inquiries" },
  { id: "team", label: "Team" },
  { id: "communications", label: "Email" },
  { id: "catalog", label: "Catalog" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-card p-5">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

function CountList({
  title,
  items,
  money = false,
  limit = 12,
}: {
  title: string;
  items: CountItem[];
  money?: boolean;
  limit?: number;
}) {
  const max = Math.max(
    1,
    ...items.map((i) => (money ? Math.abs(i.totalCents || 0) : i.count)),
  );
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">{title}</h3>
      {!items.length ? <p className="mt-4 text-sm text-white/40">No data in range</p> : null}
      <ul className="mt-4 space-y-3">
        {items.slice(0, limit).map((item) => {
          const bar = money ? Math.abs(item.totalCents || 0) : item.count;
          return (
            <li key={item.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-white/85">{item.label}</span>
                <span className="shrink-0 text-white/60">
                  {money ? `${formatCad(item.totalCents || 0)} · ` : ""}
                  {item.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#c6a75e]"
                  style={{ width: `${Math.min(100, (bar / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DayBars({ title, items }: { title: string; items: CountItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">{title}</h3>
      {!items.length ? <p className="mt-4 text-sm text-white/40">No data in range</p> : null}
      <div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto pb-1">
        {items.map((d) => (
          <div key={d.key} className="flex min-w-[1.1rem] flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[#c6a75e]/85"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              title={`${d.label}: ${d.count}`}
            />
            <span className="text-[0.55rem] text-white/35">{d.label.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsClient() {
  const [preset, setPreset] = useState<string>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<TabId>("overview");
  const [report, setReport] = useState<StudioReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ preset });
      if (preset === "custom") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load report");
        return;
      }
      setReport(data.report);
    } catch {
      setError("Could not load report");
    } finally {
      setLoading(false);
    }
  }, [preset, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams({ preset, format: "csv" });
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    window.location.href = `/api/admin/reports?${params}`;
  }

  const rangeLabel = useMemo(() => {
    if (!report) return "";
    return formatReportRangeLabel(report.from, report.to, report.timezone);
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                preset === p.id ? "admin-chip-active" : "bg-white/10 text-white/70"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="admin-btn-secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="admin-btn" onClick={exportCsv} disabled={!report}>
            Export CSV
          </button>
        </div>
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm text-white/70">
            From
            <input type="date" className="admin-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm text-white/70">
            To
            <input type="date" className="admin-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
              tab === t.id ? "admin-chip-active" : "bg-white/5 text-white/60 hover:text-white/85"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !report ? (
        <p className="text-sm text-white/50">Building studio report…</p>
      ) : (
        <>
          <p className="text-sm text-white/50">
            {rangeLabel}
            <span className="text-white/30"> · </span>
            {report.timezone.replace(/_/g, " ")}
            <span className="text-white/30"> · </span>
            Generated{" "}
            {new Intl.DateTimeFormat("en-CA", {
              timeZone: report.timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(report.generatedAt))}
          </p>

          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Appointments"
                  value={String(report.overview.appointmentsTotal)}
                  hint={`${report.overview.appointmentsCompleted} completed · ${report.overview.appointmentsPendingPayment} unpaid`}
                />
                <Kpi
                  label="Collected"
                  value={formatCad(report.overview.collectedCents)}
                  hint={`Profit ${formatCad(report.overview.profitCents)}`}
                />
                <Kpi
                  label="No-show / cancel"
                  value={`${formatPercentBps(report.overview.noShowRateBps)} / ${formatPercentBps(report.overview.cancelRateBps)}`}
                  hint={`${report.overview.appointmentsNoShow} no-shows · ${report.overview.appointmentsCancelled} cancelled`}
                />
                <Kpi
                  label="New clients"
                  value={String(report.overview.clientsNew)}
                  hint={`${report.overview.clientsTotal} total on file`}
                />
                <Kpi
                  label="Inquiries"
                  value={String(report.overview.inquiriesNew)}
                  hint={`${report.overview.inquiriesUnread} unread inbox`}
                />
                <Kpi
                  label="Emails"
                  value={String(report.overview.emailsSent)}
                  hint={
                    report.overview.emailsFailed
                      ? `${report.overview.emailsFailed} failed`
                      : "All delivered / queued"
                  }
                />
                <Kpi
                  label="Promos used"
                  value={String(report.overview.couponRedemptions)}
                  hint={`Discounts ${formatCad(report.overview.discountCents)}`}
                />
                <Kpi
                  label="Packages sold"
                  value={String(report.overview.packagePurchases)}
                  hint={`${report.overview.groupBookings} group bookings`}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <DayBars title="Appointments per day" items={report.appointments.byDay} />
                <CountList title="By status" items={report.appointments.byStatus} />
              </div>
              <p className="text-sm text-white/45">
                For ledger, expenses, and adjustments see{" "}
                <Link href="/admin/revenue" className="text-[#c6a75e] underline">
                  Revenue &amp; accounting
                </Link>
                .
              </p>
            </div>
          ) : null}

          {tab === "appointments" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Booked minutes" value={String(report.appointments.bookedMinutes)} />
                <Kpi label="Avg duration" value={`${report.appointments.avgDurationMinutes} min`} />
                <Kpi label="With add-ons" value={String(report.appointments.withAddons)} />
                <Kpi
                  label="Series / groups"
                  value={`${report.appointments.recurringSeries} / ${report.appointments.groupParties}`}
                  hint="Recurring series · party groups"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <DayBars title="Volume by day" items={report.appointments.byDay} />
                <CountList title="By status" items={report.appointments.byStatus} />
                <CountList title="By staff" items={report.appointments.byStaff} money />
                <CountList title="By category" items={report.appointments.byCategory} money />
                <CountList title="By service" items={report.appointments.byService} money limit={15} />
                <CountList title="By payment mode" items={report.appointments.byPaymentMode} money />
              </div>
            </div>
          ) : null}

          {tab === "clients" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="New in range" value={String(report.clients.newInRange)} />
                <Kpi label="Active on file" value={String(report.clients.totalActive)} hint={`${report.clients.banned} banned`} />
                <Kpi
                  label="Returning vs new"
                  value={`${report.clients.returningInRange} / ${report.clients.firstTimersInRange}`}
                  hint="Booked clients with prior visit vs first time"
                />
                <Kpi
                  label="Missing phone"
                  value={String(report.clients.missingPhone)}
                  hint="Distinct bookers in range without a number"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CountList title="Top by visits" items={report.clients.topByVisits} limit={15} />
                <CountList title="Top by spend" items={report.clients.topBySpend} money limit={15} />
              </div>
            </div>
          ) : null}

          {tab === "revenue" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Collected"
                  value={formatCad(report.revenue.summary.collectedCents)}
                  hint={`${report.revenue.summary.appointmentCount} appts · ${report.revenue.summary.packageCount} packages`}
                />
                <Kpi
                  label="Expenses"
                  value={formatCad(report.revenue.summary.expenseCents)}
                  hint={`${report.revenue.summary.expenseCount} entries`}
                />
                <Kpi label="Profit" value={formatCad(report.revenue.summary.profitCents)} />
                <Kpi
                  label="Outstanding"
                  value={formatCad(report.revenue.summary.outstandingCents)}
                  hint={`Pending holds ${formatCad(report.revenue.summary.pendingPaymentCents)}`}
                />
                <Kpi label="Tax collected" value={formatCad(report.revenue.summary.taxCents)} />
                <Kpi
                  label="Net ex-tax"
                  value={formatCad(report.revenue.summary.netExTaxCents)}
                  hint={`Discounts ${formatCad(report.revenue.summary.discountCents)}`}
                />
                <Kpi label="Package sales" value={formatCad(report.revenue.summary.packageSalesCents)} />
                <Kpi label="Refunds / write-offs" value={formatCad(report.revenue.summary.refundCents)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CountList
                  title="By staff"
                  items={report.revenue.byStaff.map((r) => ({
                    key: r.key,
                    label: r.label,
                    count: r.count,
                    totalCents: r.totalCents,
                  }))}
                  money
                />
                <CountList
                  title="By category"
                  items={report.revenue.byCategory.map((r) => ({
                    key: r.key,
                    label: r.label,
                    count: r.count,
                    totalCents: r.totalCents,
                  }))}
                  money
                />
                <CountList
                  title="By payment type"
                  items={report.revenue.byPaymentMode.map((r) => ({
                    key: r.key,
                    label: r.label,
                    count: r.count,
                    totalCents: r.totalCents,
                  }))}
                  money
                />
                <CountList
                  title="Expenses by category"
                  items={report.revenue.byExpenseCategory.map((r) => ({
                    key: r.key,
                    label: r.label,
                    count: r.count,
                    totalCents: r.totalCents,
                  }))}
                  money
                />
              </div>
              <p className="text-sm text-white/45">
                Open the full ledger and post expenses in{" "}
                <Link href="/admin/revenue" className="text-[#c6a75e] underline">
                  Revenue &amp; accounting
                </Link>
                .
              </p>
            </div>
          ) : null}

          {tab === "marketing" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Active coupons"
                  value={`${report.marketing.couponsActive} / ${report.marketing.couponsTotal}`}
                />
                <Kpi
                  label="Discounts given"
                  value={formatCad(report.marketing.discountCents)}
                  hint="On appointments in range"
                />
                <Kpi label="Active promo days" value={String(report.marketing.promoDaysActive)} />
                <Kpi
                  label="Package sessions left"
                  value={String(report.marketing.packageSessionsRemaining)}
                  hint={`${report.marketing.packageOffersActive} offers live`}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CountList title="Coupon codes used" items={report.marketing.couponUsage} money />
                <CountList title="Packages purchased" items={report.marketing.packagePurchasesInRange} money />
              </div>
            </div>
          ) : null}

          {tab === "inquiries" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Inquiries in range" value={String(report.inquiries.totalInRange)} />
                <Kpi label="With phone" value={String(report.inquiries.withPhone)} />
                <Kpi
                  label="Unread (inbox)"
                  value={String(report.overview.inquiriesUnread)}
                  hint="Current backlog, not limited to range"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <DayBars title="Inquiries per day" items={report.inquiries.byDay} />
                <CountList title="By status" items={report.inquiries.byStatus} />
                <CountList title="Top interests" items={report.inquiries.topInterests} />
              </div>
            </div>
          ) : null}

          {tab === "team" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Active team" value={String(report.team.membersActive)} />
                <Kpi
                  label="Booked appointments"
                  value={String(report.overview.appointmentsTotal)}
                  hint="Assigned + unassigned in range"
                />
                <Kpi label="Completed" value={String(report.overview.appointmentsCompleted)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CountList title="Appointments by staff" items={report.team.byStaff} money />
                <CountList title="Completed by staff" items={report.team.completedByStaff} money />
                <CountList title="No-shows by staff" items={report.team.noShowsByStaff} />
              </div>
            </div>
          ) : null}

          {tab === "communications" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Messages in range" value={String(report.communications.emailsInRange)} />
                <Kpi label="Sent / queued" value={String(report.overview.emailsSent)} />
                <Kpi label="Failed" value={String(report.overview.emailsFailed)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <DayBars title="Emails per day" items={report.communications.byDay} />
                <CountList title="By status" items={report.communications.byStatus} />
                <CountList title="By template" items={report.communications.byTemplate} limit={20} />
              </div>
            </div>
          ) : null}

          {tab === "catalog" ? (
            <div className="space-y-4">
              <p className="text-sm text-white/50">Live content snapshot (not limited to the date range).</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Categories"
                  value={String(report.catalog.categoriesPublished)}
                  hint={`${report.catalog.categoriesDraft} draft`}
                />
                <Kpi
                  label="Services"
                  value={String(report.catalog.servicesPublished)}
                  hint={`${report.catalog.servicesDraft} draft · ${report.catalog.variantsBookable} bookable variants`}
                />
                <Kpi label="Add-ons" value={String(report.catalog.addonsPublished)} />
                <Kpi label="Pages" value={String(report.catalog.pagesPublished)} />
                <Kpi label="FAQs" value={String(report.catalog.faqsPublished)} />
                <Kpi label="Care guides" value={String(report.catalog.carePublished)} />
                <Kpi label="Testimonials" value={String(report.catalog.testimonialsPublished)} />
                <Kpi
                  label="Media / templates"
                  value={`${report.catalog.mediaAssets} / ${report.catalog.emailTemplates}`}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
