"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BlockedTimesPanel } from "@/components/admin/calendar/BlockedTimesPanel";
import { DayOverridesPanel } from "@/components/admin/calendar/DayOverridesPanel";
import { PromoDaysPanel } from "@/components/admin/calendar/PromoDaysPanel";
import { WeeklyHoursEditor } from "@/components/admin/WeeklyHoursEditor";
import type { WeeklyHours } from "@/lib/booking/money";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  weeklyHours: WeeklyHours | null;
};

type TabId = "studio" | "staff" | "days" | "promos" | "blocks" | "rules";

const TABS: { id: TabId; label: string; summary: string }[] = [
  { id: "studio", label: "Studio hours", summary: "Default open days and times for public booking." },
  { id: "staff", label: "Staff hours", summary: "Per-provider schedules (or inherit studio hours)." },
  { id: "days", label: "Day edits", summary: "Close or customize a single calendar day." },
    {
      id: "promos",
      label: "Promo days",
      summary: "Extra open hours + automatic coupon discount for selected services and staff.",
    },
  { id: "blocks", label: "Blocked times", summary: "Vacations, breaks, and unavailable ranges." },
  { id: "rules", label: "Booking rules", summary: "Slot size, buffers, lead time, and booking on/off." },
];

export function AvailabilityClient({
  canWrite = true,
  canManageAll = false,
}: {
  canWrite?: boolean;
  canManageAll?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("studio");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [timezone, setTimezone] = useState("America/Toronto");
  const [studioHours, setStudioHours] = useState<WeeklyHours>({});
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffDraft, setStaffDraft] = useState<Record<string, WeeklyHours | null>>({});
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [minLeadHours, setMinLeadHours] = useState(24);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/availability");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load availability");
        return;
      }
      setTimezone(data.timezone || "America/Toronto");
      setStudioHours(data.studioWeeklyHours || {});
      setBookingEnabled(Boolean(data.bookingEnabled));
      setSlotIntervalMinutes(data.slotIntervalMinutes ?? 30);
      setBufferMinutes(data.bufferMinutes ?? 15);
      setMinLeadHours(data.minLeadHours ?? 24);
      setMaxAdvanceDays(data.maxAdvanceDays ?? 60);
      const members = (data.staff || []) as StaffRow[];
      setStaff(members);
      const draft: Record<string, WeeklyHours | null> = {};
      for (const m of members) draft[m.id] = m.weeklyHours;
      setStaffDraft(draft);
    } catch {
      setError("Could not load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStudioHours() {
    if (!canWrite || !canManageAll) return;
    setSaving(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioWeeklyHours: studioHours }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save studio hours");
      return;
    }
    setStatus("Studio hours saved");
    await load();
  }

  async function saveStaffHours(id: string) {
    if (!canWrite || !canManageAll) return;
    setSaving(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffHours: [{ id, weeklyHours: staffDraft[id] ?? null }],
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save staff hours");
      return;
    }
    setStatus("Staff hours saved");
    await load();
  }

  async function saveRules() {
    if (!canWrite || !canManageAll) return;
    setSaving(true);
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingEnabled,
        slotIntervalMinutes,
        bufferMinutes,
        minLeadHours,
        maxAdvanceDays,
        timezone,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save booking rules");
      return;
    }
    setStatus("Booking rules saved");
    await load();
  }

  const tabMeta = TABS.find((t) => t.id === tab)!;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setStatus("");
              setError("");
            }}
            className={`rounded-full px-4 py-2 text-[0.68rem] uppercase tracking-[0.14em] transition ${
              tab === t.id ? "admin-chip-active" : "bg-white/10 text-white/65 hover:bg-white/15 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm text-white/55">{tabMeta.summary}</p>
      {loading ? <p className="text-sm text-white/50">Loading…</p> : null}
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {status ? <p className="mb-4 text-sm text-[#c6a75e]">{status}</p> : null}

      {!loading && tab === "studio" ? (
        <div className="admin-card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Studio weekly hours</h2>
              <p className="mt-1 text-sm text-white/50">
                Timezone: <span className="text-white/80">{timezone.replace(/_/g, " ")}</span>
              </p>
            </div>
            {canManageAll && canWrite ? (
              <button type="button" className="admin-btn" disabled={saving} onClick={() => void saveStudioHours()}>
                {saving ? "Saving…" : "Save studio hours"}
              </button>
            ) : null}
          </div>
          <WeeklyHoursEditor
            mode="studio"
            label="Open days"
            value={studioHours}
            onChange={(next) => setStudioHours(next || {})}
          />
          <p className="mt-4 text-xs text-white/40">
            Payments and tax stay under{" "}
            <Link href="/admin/settings/booking" className="text-[#c6a75e] hover:underline">
              Settings → Booking
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!loading && tab === "staff" ? (
        <div className="space-y-3">
          {!staff.length ? (
            <div className="admin-card p-6 text-sm text-white/50">
              No active staff yet. Add providers in{" "}
              <Link href="/admin/team" className="text-[#c6a75e] hover:underline">
                Team
              </Link>
              .
            </div>
          ) : null}
          {staff.map((s) => {
            const open = expandedStaffId === s.id;
            const hours = staffDraft[s.id] ?? null;
            return (
              <div key={s.id} className="admin-card overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03]"
                  onClick={() => setExpandedStaffId(open ? null : s.id)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                    <div className="min-w-0">
                      <p className="font-medium text-white">{s.name}</p>
                      <p className="text-xs text-white/45">
                        {hours ? "Custom weekly hours" : "Uses studio hours"} · {s.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-white/40">{open ? "▴" : "▾"}</span>
                </button>
                {open ? (
                  <div className="border-t border-white/10 px-5 py-5">
                    <WeeklyHoursEditor
                      mode="staff"
                      label={`${s.name}'s hours`}
                      value={hours}
                      onChange={(next) => setStaffDraft((prev) => ({ ...prev, [s.id]: next }))}
                    />
                    {canManageAll && canWrite ? (
                      <button
                        type="button"
                        className="admin-btn mt-4"
                        disabled={saving}
                        onClick={() => void saveStaffHours(s.id)}
                      >
                        {saving ? "Saving…" : "Save hours"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "days" ? (
        <DayOverridesPanel canWrite={canWrite} canManageAll={canManageAll} staff={staff} />
      ) : null}

      {tab === "promos" ? (
        <PromoDaysPanel canWrite={canWrite} canManageAll={canManageAll} staff={staff} />
      ) : null}

      {tab === "blocks" ? (
        <BlockedTimesPanel canWrite={canWrite} canManageAll={canManageAll} staff={staff} />
      ) : null}

      {!loading && tab === "rules" ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold text-white">Booking rules</h2>
          <p className="mt-1 text-sm text-white/50">
            These control how online booking builds available dates and time slots.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-white/80 sm:col-span-2">
              <input
                type="checkbox"
                checked={bookingEnabled}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setBookingEnabled(e.target.checked)}
              />
              Native online booking enabled
            </label>
            <label className="grid gap-1 text-sm text-white/70">
              Timezone
              <input
                className="admin-input"
                value={timezone}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm text-white/70">
              Slot interval (minutes)
              <input
                type="number"
                min={5}
                className="admin-input"
                value={slotIntervalMinutes}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-sm text-white/70">
              Buffer between appointments (minutes)
              <input
                type="number"
                min={0}
                className="admin-input"
                value={bufferMinutes}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-sm text-white/70">
              Minimum lead time (hours)
              <input
                type="number"
                min={0}
                className="admin-input"
                value={minLeadHours}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setMinLeadHours(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-sm text-white/70">
              Max days ahead to book
              <input
                type="number"
                min={1}
                className="admin-input"
                value={maxAdvanceDays}
                disabled={!canManageAll || !canWrite}
                onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
              />
            </label>
          </div>
          {canManageAll && canWrite ? (
            <button type="button" className="admin-btn mt-6" disabled={saving} onClick={() => void saveRules()}>
              {saving ? "Saving…" : "Save booking rules"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
