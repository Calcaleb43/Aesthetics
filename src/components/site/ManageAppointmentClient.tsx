"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { zonedParts } from "@/lib/booking/money";

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

function dateKeyInTimezone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function ManageAppointmentClient({ token }: { token: string }) {
  const [appointment, setAppointment] = useState<AppointmentView | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedStart, setSelectedStart] = useState("");

  const timezone = appointment?.timezone || "America/Toronto";

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
      const appt = data.appointment as AppointmentView;
      setAppointment(appt);
      if (appt?.startsAt) {
        const key = dateKeyInTimezone(appt.startsAt, appt.timezone || "America/Toronto");
        const [y, m] = key.split("-").map(Number);
        setMonth(startOfMonth(new Date(y, m - 1, 1)));
      }
    } catch {
      setError("Could not load appointment");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment) {
      setAvailableDates([]);
      return;
    }
    let cancelled = false;
    setLoadingDates(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          datesOnly: "1",
          month: format(month, "yyyy-MM"),
          items: JSON.stringify(appointment.items),
          excludeAppointmentId: appointment.id,
        });
        if (appointment.staffId) params.set("staffId", appointment.staffId);
        const res = await fetch(`/api/booking/availability?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAvailableDates([]);
          return;
        }
        setAvailableDates(data.availableDates || []);
      } catch {
        if (!cancelled) setAvailableDates([]);
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, appointment, month]);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment || !selectedDay) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setError("");
      try {
        const params = new URLSearchParams({
          date: selectedDay,
          items: JSON.stringify(appointment.items),
          excludeAppointmentId: appointment.id,
        });
        if (appointment.staffId) params.set("staffId", appointment.staffId);
        const res = await fetch(`/api/booking/availability?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not load times");
          setSlots([]);
          return;
        }
        setSlots(data.slots || []);
      } catch {
        if (!cancelled) setError("Could not load times");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, appointment, selectedDay]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  function openReschedule() {
    if (!appointment) return;
    const key = dateKeyInTimezone(appointment.startsAt, appointment.timezone);
    const [y, m] = key.split("-").map(Number);
    setMonth(startOfMonth(new Date(y, m - 1, 1)));
    setSelectedDay(null);
    setSelectedStart("");
    setSlots([]);
    setMode("reschedule");
    setStatus("");
    setError("");
  }

  function selectDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDay(key);
    setSelectedStart("");
    setError("");
  }

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
  const todayKey = zonedParts(new Date(), timezone).dateKey;

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
            <button type="button" className="btn btn-gold" disabled={busy} onClick={openReschedule}>
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
        <div className="space-y-6 rounded-2xl border border-[var(--line)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Pick a new date &amp; time</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Same services · same duration · must stay at least 48 hours ahead
              </p>
            </div>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                setMode("view");
                setSelectedDay(null);
                setSelectedStart("");
              }}
            >
              Back
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">Date</p>
              <div className="mb-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-black/20 px-3 text-xs uppercase tracking-[0.12em]"
                  onClick={() => setMonth(startOfMonth(addDays(month, -15)))}
                >
                  Prev
                </button>
                <p className="min-w-[9rem] text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
                <button
                  type="button"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-black/20 px-3 text-xs uppercase tracking-[0.12em]"
                  onClick={() => setMonth(startOfMonth(addDays(endOfMonth(month), 1)))}
                >
                  Next
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] uppercase tracking-[0.08em] text-[var(--ink-soft)] sm:gap-2 sm:text-xs sm:tracking-[0.12em]">
                {[
                  ["S", "Sun"],
                  ["M", "Mon"],
                  ["T", "Tue"],
                  ["W", "Wed"],
                  ["T", "Thu"],
                  ["F", "Fri"],
                  ["S", "Sat"],
                ].map(([short, full]) => (
                  <span key={full}>
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{full}</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {daysInMonth.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const active = selectedDay === key;
                  const past = key < todayKey;
                  const open = availableDates.includes(key);
                  const disabled = past || (!open && !loadingDates);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectDay(day)}
                      className={`aspect-square min-h-10 rounded-xl text-sm transition sm:min-h-0 ${
                        active
                          ? "bg-black text-white"
                          : disabled
                            ? "cursor-not-allowed text-black/25"
                            : "border border-black/10 hover:border-black/40"
                      }`}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-[var(--ink-soft)]">
                {loadingDates
                  ? "Checking open days…"
                  : availableDates.some((key) => key >= todayKey)
                    ? "Only dates with open times are selectable."
                    : "No open dates this month. Try the next month."}{" "}
                Times in {timezone.replace(/_/g, " ")}.
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">Time</p>
              {!selectedDay ? (
                <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-sm text-[var(--ink-soft)]">
                  Select a date to see available times.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-[var(--ink-soft)]">
                    {format(parseISO(`${selectedDay}T12:00:00`), "EEEE, MMMM d")}
                  </p>
                  {loadingSlots ? (
                    <p className="text-sm text-[var(--ink-soft)]">Loading times…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">No open times this day. Pick another date.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slots.map((slot) => {
                        const label = new Intl.DateTimeFormat("en-CA", {
                          timeZone: timezone,
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(slot.start));
                        const active = selectedStart === slot.start;
                        return (
                          <button
                            key={`${slot.start}-${slot.staffId || "any"}`}
                            type="button"
                            onClick={() => setSelectedStart(slot.start)}
                            className={`rounded-xl px-3 py-3 text-sm transition ${
                              active ? "bg-black text-white" : "border border-black/15 hover:border-black/40"
                            }`}
                          >
                            {label}
                            {slot.staffName ? (
                              <span
                                className={`mt-1 block text-xs ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}
                              >
                                {slot.staffName}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-gold"
            disabled={!selectedDay || !selectedStart || busy}
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
