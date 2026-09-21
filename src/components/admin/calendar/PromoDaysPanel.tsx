"use client";

import { FormEvent, useEffect, useState } from "react";

type VariantOpt = { id: string; title: string; priceCents: number; priceLabel: string };

type ServiceOpt = {
  id: string;
  title: string;
  priceCents: number;
  priceLabel: string;
  variants: VariantOpt[];
};

type ServiceRow = {
  id: string;
  serviceId?: string;
  variantId: string | null;
  title: string;
  regularPriceCents?: number;
  regularPriceLabel?: string;
  promoPriceCents: number | null;
  promoPriceLabel?: string | null;
};

type PromoDayItem = {
  id: string;
  date: string;
  endDate: string;
  recurrence: string;
  recurrenceLabel?: string;
  seriesId: string | null;
  staffId: string;
  staffName: string | null;
  couponId: string | null;
  couponCode: string | null;
  couponName: string | null;
  couponType?: string | null;
  closed: boolean;
  windows: { start: string; end: string }[];
  note: string;
  active: boolean;
  serviceIds: string[];
  services: ServiceRow[];
};

type Option = {
  id: string;
  name?: string;
  code?: string;
  type?: string;
  amount?: number;
};

/** Selection key: serviceId or serviceId:variantId */
type PriceEntry = { serviceId: string; variantId: string | null; dollars: string };

function dollarsFromCents(cents: number | null | undefined) {
  if (cents == null || Number.isNaN(cents)) return "";
  const d = cents / 100;
  return Number.isInteger(d) ? String(d) : d.toFixed(2);
}

function centsFromDollars(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function entryKey(serviceId: string, variantId: string | null) {
  return variantId ? `${serviceId}:${variantId}` : serviceId;
}

export function PromoDaysPanel({
  canWrite = true,
  canManageAll = false,
  staff = [],
}: {
  canWrite?: boolean;
  canManageAll?: boolean;
  staff?: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState<PromoDayItem[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [coupons, setCoupons] = useState<Option[]>([]);
  const [staffOptions, setStaffOptions] = useState<Option[]>([]);
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [materialize, setMaterialize] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [couponId, setCouponId] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [entries, setEntries] = useState<Record<string, PriceEntry>>({});

  async function load() {
    try {
      const res = await fetch("/api/admin/promo-days");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Could not load promo days");
        return;
      }
      setRows(
        (data.promoDays || []).map((r: PromoDayItem) => ({
          ...r,
          windows: Array.isArray(r.windows) ? r.windows : [],
        })),
      );
      setServices(data.services || []);
      setCoupons(data.coupons || []);
      setStaffOptions(data.staff?.length ? data.staff : staff);
    } catch {
      setStatus("Could not load promo days");
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

  function openCreate() {
    setEditingId(null);
    setDate("");
    setEndDate("");
    setRecurrence("none");
    setMaterialize(false);
    setStaffId(staff[0]?.id || staffOptions[0]?.id || "");
    setCouponId("");
    setStart("10:00");
    setEnd("18:00");
    setNote("");
    setActive(true);
    setEntries({});
    setModalOpen(true);
  }

  function openEdit(row: PromoDayItem) {
    setEditingId(row.id);
    setDate(row.date);
    setEndDate(row.endDate || row.date);
    setRecurrence(
      row.recurrence === "weekly" || row.recurrence === "biweekly" || row.recurrence === "monthly"
        ? row.recurrence
        : "none",
    );
    setMaterialize(false);
    setStaffId(row.staffId);
    setCouponId(row.couponId || "");
    setStart(row.windows[0]?.start || "10:00");
    setEnd(row.windows[0]?.end || "18:00");
    setNote(row.note || "");
    setActive(row.active);
    const next: Record<string, PriceEntry> = {};
    for (const s of row.services || []) {
      const serviceId = s.serviceId || s.id;
      const variantId = s.variantId || null;
      const key = entryKey(serviceId, variantId);
      next[key] = {
        serviceId,
        variantId,
        dollars: dollarsFromCents(s.promoPriceCents),
      };
    }
    setEntries(next);
    setModalOpen(true);
  }

  function toggleBaseService(serviceId: string) {
    const key = entryKey(serviceId, null);
    setEntries((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { serviceId, variantId: null, dollars: "" };
      return next;
    });
  }

  function toggleVariant(serviceId: string, variantId: string) {
    const key = entryKey(serviceId, variantId);
    setEntries((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { serviceId, variantId, dollars: "" };
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (!staffId) {
      setStatus("Select staff for this promo day");
      return;
    }
    const list = Object.values(entries);
    if (!list.length) {
      setStatus("Select at least one service or variant");
      return;
    }

    const servicesPayload = list.map((e) => ({
      serviceId: e.serviceId,
      variantId: e.variantId,
      promoPriceCents: centsFromDollars(e.dollars),
    }));
    const hasPrices = servicesPayload.some((s) => s.promoPriceCents != null);
    if (!couponId && !hasPrices) {
      setStatus("Add a coupon and/or set a promo price on at least one service/variant");
      return;
    }

    setSaving(true);
    setStatus("");
    const res = await fetch("/api/admin/promo-days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId || undefined,
        date,
        endDate: endDate || date,
        recurrence,
        materialize: !editingId && materialize && recurrence !== "none",
        staffId,
        couponId: couponId || null,
        closed: false,
        windows: [{ start, end }],
        note,
        active,
        services: servicesPayload,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Could not save promo day");
      return;
    }
    setModalOpen(false);
    setStatus(
      data.promoDays?.length
        ? `Created ${data.promoDays.length} promo days`
        : editingId
          ? "Promo day updated"
          : "Promo day saved",
    );
    await load();
  }

  async function duplicate(row: PromoDayItem, mode: "weekly" | "biweekly" | "monthly") {
    if (!canWrite) return;
    const count = window.prompt(
      mode === "monthly"
        ? "How many months to copy forward?"
        : mode === "biweekly"
          ? "How many biweekly copies?"
          : "How many weekly copies?",
      "8",
    );
    if (!count) return;
    const n = Math.min(52, Math.max(1, Number(count) || 8));
    setStatus("Duplicating…");
    const res = await fetch("/api/admin/promo-days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", id: row.id, mode, count: n }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Could not duplicate");
      return;
    }
    setStatus(`Created ${data.count || n} copies`);
    await load();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    if (!window.confirm("Remove this promo day?")) return;
    await fetch("/api/admin/promo-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStatus("Promo day removed");
    await load();
  }

  async function removeSeries(seriesId: string) {
    if (!canWrite) return;
    if (!window.confirm("Remove this entire duplicated series?")) return;
    await fetch("/api/admin/promo-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId }),
    });
    setStatus("Series removed");
    await load();
  }

  const providers = staffOptions.length ? staffOptions : staff;

  return (
    <div className="admin-card mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Promo days</h2>
          <p className="mt-1 text-sm text-white/50">
            Date ranges or recurring days for selected services and variants. Discount with a coupon
            (percent / fixed $) and/or custom promo prices. Duplicate weekly or monthly for quick
            series.
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="admin-btn" onClick={openCreate}>
            Add promo day
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
              <p className="font-medium text-white">
                {r.date === r.endDate ? r.date : `${r.date} → ${r.endDate}`}
                {r.recurrence && r.recurrence !== "none" ? (
                  <span className="ml-2 text-[0.62rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                    {r.recurrenceLabel || r.recurrence}
                  </span>
                ) : null}
                {!r.active ? (
                  <span className="ml-2 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                    inactive
                  </span>
                ) : null}
              </p>
              <p className="text-white/50">
                {r.windows.map((w) => `${w.start}–${w.end}`).join(", ") || "No hours"}
                {r.staffName ? ` · ${r.staffName}` : ""}
                {r.couponCode
                  ? ` · coupon ${r.couponCode}${
                      r.couponType === "fixed"
                        ? " (fixed $)"
                        : r.couponType === "percent"
                          ? " (%)"
                          : ""
                    }`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {r.services
                  .map((s) =>
                    s.promoPriceLabel
                      ? `${s.title} ${s.regularPriceLabel || ""} → ${s.promoPriceLabel}`
                      : s.title,
                  )
                  .join(", ") || "No services"}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.12em] text-[#c6a75e]"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.12em] text-white/55"
                  onClick={() => void duplicate(r, "weekly")}
                >
                  + Weekly
                </button>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.12em] text-white/55"
                  onClick={() => void duplicate(r, "monthly")}
                >
                  + Monthly
                </button>
                {r.seriesId ? (
                  <button
                    type="button"
                    className="text-xs uppercase tracking-[0.12em] text-red-300/80"
                    onClick={() => void removeSeries(r.seriesId!)}
                  >
                    Remove series
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.12em] text-red-300"
                  onClick={() => void remove(r.id)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {!rows.length ? <p className="text-sm text-white/45">No promo days yet.</p> : null}
      </ul>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-6"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <h3 className="text-lg font-semibold text-white">
              {editingId ? "Edit promo day" : "Add promo day"}
            </h3>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-white/70">
                  Start date
                  <input
                    type="date"
                    className="admin-input"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  End date
                  <input
                    type="date"
                    className="admin-input"
                    value={endDate || date}
                    min={date || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm text-white/70">
                Repeat
                <select
                  className="admin-input"
                  value={recurrence}
                  onChange={(e) =>
                    setRecurrence(e.target.value as "none" | "weekly" | "biweekly" | "monthly")
                  }
                >
                  <option value="none">Every day in range</option>
                  <option value="weekly">Weekly (same weekday)</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly (same day of month)</option>
                </select>
              </label>
              {!editingId && recurrence !== "none" ? (
                <label className="flex items-start gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={materialize}
                    onChange={(e) => setMaterialize(e.target.checked)}
                  />
                  <span>
                    Create separate days for each occurrence (easier to edit individually). Leave
                    unchecked to keep one recurring rule.
                  </span>
                </label>
              ) : null}
              <label className="grid gap-1 text-sm text-white/70">
                Staff
                <select
                  className="admin-input"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                  disabled={!canManageAll && Boolean(staffId)}
                >
                  <option value="">Select staff</option>
                  {providers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Coupon (optional — percent or fixed $)
                <select
                  className="admin-input"
                  value={couponId}
                  onChange={(e) => setCouponId(e.target.value)}
                >
                  <option value="">None — use promo prices only</option>
                  {coupons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                      {c.type === "percent"
                        ? ` (−${((c.amount || 0) / 100).toFixed((c.amount || 0) % 100 === 0 ? 0 : 2)}%)`
                        : c.type === "fixed"
                          ? ` (−$${((c.amount || 0) / 100).toFixed(2)})`
                          : ""}
                      {c.name ? ` — ${c.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-white/70">
                  Opens
                  <input
                    type="time"
                    className="admin-input"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm text-white/70">
                  Closes
                  <input
                    type="time"
                    className="admin-input"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                </label>
              </div>
              <fieldset className="grid gap-2 text-sm text-white/70">
                <legend>Services &amp; variants</legend>
                <p className="text-xs text-white/40">
                  Select a base service and/or specific variants. Optional promo price sets a reduced
                  base price for that item.
                </p>
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-white/10 p-3">
                  {services.map((s) => {
                    const baseKey = entryKey(s.id, null);
                    const baseChecked = Boolean(entries[baseKey]);
                    return (
                      <div
                        key={s.id}
                        className="grid gap-2 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                      >
                        <label className="flex items-start gap-2 text-sm text-white/80">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={baseChecked}
                            onChange={() => toggleBaseService(s.id)}
                          />
                          <span>
                            {s.title}
                            <span className="mt-0.5 block text-xs text-white/40">
                              Base · regular {s.priceLabel}
                            </span>
                          </span>
                        </label>
                        {baseChecked ? (
                          <label className="ml-6 grid gap-1 text-xs text-white/55">
                            Promo price (CAD)
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="admin-input"
                              placeholder="Leave blank for coupon-only"
                              value={entries[baseKey]?.dollars || ""}
                              onChange={(e) =>
                                setEntries((prev) => ({
                                  ...prev,
                                  [baseKey]: {
                                    serviceId: s.id,
                                    variantId: null,
                                    dollars: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ) : null}
                        {s.variants?.length ? (
                          <div className="ml-4 space-y-2 border-l border-white/10 pl-3">
                            {s.variants.map((v) => {
                              const vKey = entryKey(s.id, v.id);
                              const checked = Boolean(entries[vKey]);
                              return (
                                <div key={v.id} className="grid gap-1">
                                  <label className="flex items-start gap-2 text-sm text-white/75">
                                    <input
                                      type="checkbox"
                                      className="mt-1"
                                      checked={checked}
                                      onChange={() => toggleVariant(s.id, v.id)}
                                    />
                                    <span>
                                      {v.title}
                                      <span className="mt-0.5 block text-xs text-white/40">
                                        Variant · regular {v.priceLabel}
                                      </span>
                                    </span>
                                  </label>
                                  {checked ? (
                                    <label className="ml-6 grid gap-1 text-xs text-white/55">
                                      Promo price (CAD)
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        className="admin-input"
                                        value={entries[vKey]?.dollars || ""}
                                        onChange={(e) =>
                                          setEntries((prev) => ({
                                            ...prev,
                                            [vKey]: {
                                              serviceId: s.id,
                                              variantId: v.id,
                                              dollars: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!services.length ? (
                    <p className="text-xs text-white/40">No bookable services found.</p>
                  ) : null}
                </div>
              </fieldset>
              <label className="grid gap-1 text-sm text-white/70">
                Note
                <input
                  className="admin-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Spring brow special"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active (show in public booking)
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
