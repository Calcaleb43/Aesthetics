"use client";

import { FormEvent, useEffect, useState } from "react";

type ServiceRow = {
  id: string;
  title: string;
  regularPriceCents?: number;
  regularPriceLabel?: string;
  promoPriceCents: number | null;
  promoPriceLabel?: string | null;
};

type PromoDayItem = {
  id: string;
  date: string;
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
  title?: string;
  code?: string;
  type?: string;
  amount?: number;
  priceCents?: number;
  priceLabel?: string;
};

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
  const [services, setServices] = useState<Option[]>([]);
  const [coupons, setCoupons] = useState<Option[]>([]);
  const [staffOptions, setStaffOptions] = useState<Option[]>([]);
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [staffId, setStaffId] = useState("");
  const [couponId, setCouponId] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  /** serviceId → promo price dollars string (empty = no override) */
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

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
    setStaffId(staff[0]?.id || staffOptions[0]?.id || "");
    setCouponId("");
    setStart("10:00");
    setEnd("18:00");
    setNote("");
    setActive(true);
    setSelectedServiceIds([]);
    setServicePrices({});
    setModalOpen(true);
  }

  function openEdit(row: PromoDayItem) {
    setEditingId(row.id);
    setDate(row.date);
    setStaffId(row.staffId);
    setCouponId(row.couponId || "");
    setStart(row.windows[0]?.start || "10:00");
    setEnd(row.windows[0]?.end || "18:00");
    setNote(row.note || "");
    setActive(row.active);
    setSelectedServiceIds(row.serviceIds || []);
    const prices: Record<string, string> = {};
    for (const s of row.services || []) {
      prices[s.id] = dollarsFromCents(s.promoPriceCents);
    }
    setServicePrices(prices);
    setModalOpen(true);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) {
        setServicePrices((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (!staffId) {
      setStatus("Select staff for this promo day");
      return;
    }
    if (!selectedServiceIds.length) {
      setStatus("Select at least one service");
      return;
    }

    const servicesPayload = selectedServiceIds.map((serviceId) => ({
      serviceId,
      promoPriceCents: centsFromDollars(servicePrices[serviceId] || ""),
    }));
    const hasPrices = servicesPayload.some((s) => s.promoPriceCents != null);
    if (!couponId && !hasPrices) {
      setStatus("Add a coupon and/or set a promo price on at least one service");
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
    setStatus(editingId ? "Promo day updated" : "Promo day saved");
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

  const providers = staffOptions.length ? staffOptions : staff;

  return (
    <div className="admin-card mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Promo days</h2>
          <p className="mt-1 text-sm text-white/50">
            Extra hours for selected services and staff. Reduce price with a coupon (percent or fixed
            $) and/or a custom promo price per service.
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
                {r.date}
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
                  ? ` · coupon ${r.couponCode}${r.couponType === "fixed" ? " (fixed $)" : r.couponType === "percent" ? " (%)" : ""}`
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
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.12em] text-[#c6a75e]"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </button>
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
              <label className="grid gap-1 text-sm text-white/70">
                Date
                <input
                  type="date"
                  className="admin-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
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
                  <option value="">None — use service promo prices only</option>
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
                <span className="text-xs text-white/40">
                  Create coupons under Coupons. Fixed = dollar off; percent = % off. Or set promo
                  prices below.
                </span>
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
                <legend>Services &amp; promo prices</legend>
                <p className="text-xs text-white/40">
                  Check a service to include it. Optional promo price (CAD) sets a reduced base price
                  for that service on this day.
                </p>
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-white/10 p-3">
                  {services.map((s) => {
                    const checked = selectedServiceIds.includes(s.id);
                    return (
                      <div key={s.id} className="grid gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                        <label className="flex items-start gap-2 text-sm text-white/80">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleService(s.id)}
                          />
                          <span>
                            {s.title || s.name}
                            <span className="mt-0.5 block text-xs text-white/40">
                              Regular {s.priceLabel || "—"}
                            </span>
                          </span>
                        </label>
                        {checked ? (
                          <label className="ml-6 grid gap-1 text-xs text-white/55">
                            Promo price (CAD, optional)
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="admin-input"
                              placeholder="e.g. 120"
                              value={servicePrices[s.id] || ""}
                              onChange={(e) =>
                                setServicePrices((prev) => ({ ...prev, [s.id]: e.target.value }))
                              }
                            />
                          </label>
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
