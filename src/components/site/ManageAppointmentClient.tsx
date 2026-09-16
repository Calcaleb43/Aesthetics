"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";

type AppointmentView = {
  id: string;
  status: string;
  title: string;
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  clientName: string;
  clientEmail: string;
  staffName: string | null;
  staffId: string | null;
  categorySlug: string;
  serviceIds: string[];
  items: { serviceId: string; variantId?: string | null; quantity?: number }[];
  canCancel: boolean;
  canReschedule: boolean;
  minLeadHours: number;
  timezone: string;
};

type Slot = { start: string; end: string; staffId: string | null; staffName: string | null };

export function ManageAppointmentClient({ token }: { token: string }) {
  const [appointment, setAppointment] = useState<AppointmentView | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedStart, setSelectedStart] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/booking/manage?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load appointment");
        setAppointment(null);
        return;
      }
      setAppointment(data.appointment);
      setDay((prev) => prev || (data.appointment?.startsAt ? format(new Date(data.appointment.startsAt), "yyyy-MM-dd") : ""));
    } catch {
      setError("Could not load appointment");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayOptions = useMemo(() => {
    const out: string[] = [];
    const start = new Date();
    for (let i = 0; i < 28; i++) {
      out.push(format(addDays(start, i), "yyyy-MM-dd"));
    }
    return out;
  }, []);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment || !day) return;
    let cancelled = false;
    async function loadSlots() {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedStart("");
      try {
        const from = new Date(`${day}T00:00:00`);
        const to = addDays(from, 1);
        const params = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
          items: JSON.stringify(appointment!.items),
          excludeAppointmentId: appointment!.id,
        });
        if (appointment!.staffId) params.set("staffId", appointment!.staffId);
        const res = await fetch(`/api/booking/availability?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not load times");
          return;
        }
        setSlots(data.slots || []);
      } catch {
        if (!cancelled) setError("Could not load times");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [mode, appointment, day]);

  async function cancelAppointment() {
    if (!appointment?.canCancel) return;
    if (!window.confirm("Cancel this appointment? The studio will be notified.")) return;
    setBusy(true);
    setError("");
    setStatus("");
    const res = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not cancel");
      return;
    }
    setStatus("Your appointment has been cancelled. A confirmation was sent by email.");
    setMode("view");
    await load();
  }

  async function confirmReschedule() {
    if (!selectedStart || !appointment?.canReschedule) return;
    setBusy(true);
    setError("");
    setStatus("");
    const res = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "reschedule", startsAt: selectedStart }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not reschedule");
      return;
    }
    setStatus(`Rescheduled to ${data.whenLabel || "your new time"}. Confirmation sent.`);
    setMode("view");
    await load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-soft)]">Loading your appointment…</p>;
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700">{error || "This manage link is invalid or expired."}</p>
        <Link href="/book-now" className="btn btn-gold">
          Book again
        </Link>
      </div>
    );
  }

  const ended = ["cancelled", "completed", "expired", "no_show"].includes(appointment.status);

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {status ? <p className="text-sm text-[var(--gold-deep)]">{status}</p> : null}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          {appointment.status.replace(/_/g, " ")}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{appointment.title}</h2>
        <p className="mt-3 text-lg text-[var(--ink-soft)]">{appointment.whenLabel}</p>
        {appointment.staffName ? (
          <p className="mt-1 text-sm text-[var(--ink-soft)]">With {appointment.staffName}</p>
        ) : null}
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          {appointment.clientName} · {appointment.clientEmail}
        </p>
      </div>

      {!ended ? (
        <div className="flex flex-wrap gap-3">
          {appointment.canReschedule ? (
            <button
              type="button"
              className="btn btn-gold"
              disabled={busy}
              onClick={() => {
                setMode("reschedule");
                setStatus("");
                setError("");
              }}
            >
              Reschedule
            </button>
          ) : null}
          {appointment.canCancel ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void cancelAppointment()}>
              {busy ? "Working…" : "Cancel appointment"}
            </button>
          ) : null}
          {!appointment.canCancel && !appointment.canReschedule ? (
            <p className="text-sm text-[var(--ink-soft)]">
              Online cancel and reschedule close 48 hours before your visit. Please contact the studio for changes
              inside that window.
            </p>
          ) : null}
        </div>
      ) : (
        <Link href="/book-now" className="btn btn-gold">
          Book a new appointment
        </Link>
      )}

      {mode === "reschedule" && appointment.canReschedule ? (
        <div className="space-y-4 rounded-2xl border border-[var(--line)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Pick a new time</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Same services · same duration · must stay at least 48 hours ahead
              </p>
            </div>
            <button type="button" className="text-sm underline" onClick={() => setMode("view")}>
              Back
            </button>
          </div>
          <label className="grid max-w-xs gap-1 text-sm">
            Date
            <select className="rounded-lg border border-[var(--line)] px-3 py-2" value={day} onChange={(e) => setDay(e.target.value)}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {loadingSlots ? <p className="text-sm text-[var(--ink-soft)]">Loading times…</p> : null}
          {!loadingSlots && !slots.length ? (
            <p className="text-sm text-[var(--ink-soft)]">No open times on this day.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => setSelectedStart(s.start)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selectedStart === s.start
                    ? "bg-[var(--gold)] text-black"
                    : "border border-[var(--line)] hover:border-[var(--gold)]"
                }`}
              >
                {new Date(s.start).toLocaleTimeString("en-CA", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: appointment.timezone,
                })}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-gold"
            disabled={!selectedStart || busy}
            onClick={() => void confirmReschedule()}
          >
            {busy ? "Saving…" : "Confirm new time"}
          </button>
        </div>
      ) : null}

      <p className="text-sm text-[var(--ink-soft)]">
        Need help?{" "}
        <Link href="/contact" className="underline">
          Contact the studio
        </Link>
        .
      </p>
    </div>
  );
}
