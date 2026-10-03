"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  amountDueCents: number;
  amountDueLabel: string;
  staffId: string | null;
  staffName: string | null;
  serviceIds: string[];
  items: { serviceId: string; variantIds: string[] }[];
  timezone: string;
};

type Slot = { start: string; end: string; staffId: string | null; staffName: string | null };

export function CompletePaymentClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [slotAvailable, setSlotAvailable] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentView | null>(null);
  const [busy, setBusy] = useState(false);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedStart, setSelectedStart] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const timezone = appointment?.timezone || "America/Toronto";

  const autoPayStarted = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/booking/complete-payment?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load booking");
        setAppointment(null);
        return;
      }
      if (data.alreadyConfirmed) {
        setAlreadyConfirmed(true);
        setAppointment(data.appointment || null);
        return;
      }
      setAlreadyConfirmed(false);
      setSlotAvailable(Boolean(data.slotAvailable));
      setAppointment(data.appointment || null);
      if (data.appointment?.startsAt) {
        const tzKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: data.appointment.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(data.appointment.startsAt));
        const [y, m] = tzKey.split("-").map(Number);
        setMonth(startOfMonth(new Date(y, m - 1, 1)));
      }
    } catch {
      setError("Could not load booking");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const continueToPay = useCallback(async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/booking/complete-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "pay" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.slotAvailable === false) {
      setBusy(false);
      setSlotAvailable(false);
      setError(data.error || "That time is no longer available. Pick a new date and time.");
      return;
    }
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not continue to payment");
      return;
    }
    if (data.confirmed) {
      window.location.href = `/book-now/success?appointment=${appointment?.id || ""}`;
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    setBusy(false);
    setError("Checkout is not available right now.");
  }, [token, appointment?.id]);

  // When the held slot is still open, go straight to checkout (email CTA → pay).
  useEffect(() => {
    if (loading || !appointment || alreadyConfirmed || !slotAvailable || autoPayStarted.current) return;
    autoPayStarted.current = true;
    void continueToPay();
  }, [loading, appointment, alreadyConfirmed, slotAvailable, continueToPay]);

  useEffect(() => {
    if (slotAvailable || !appointment) {
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
        setAvailableDates(res.ok ? data.availableDates || [] : []);
      } catch {
        if (!cancelled) setAvailableDates([]);
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slotAvailable, appointment, month]);

  useEffect(() => {
    if (slotAvailable || !appointment || !selectedDay) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
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
  }, [slotAvailable, appointment, selectedDay]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  async function confirmNewTimeAndPay() {
    if (!selectedStart) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/booking/complete-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action: "reschedule",
        startsAt: selectedStart,
        staffId: selectedStaffId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update your time");
      return;
    }
    if (data.confirmed) {
      window.location.href = `/book-now/success?appointment=${appointment?.id || ""}`;
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    setError("Checkout is not available right now.");
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-soft)]">Checking your booking…</p>;
  }

  if (alreadyConfirmed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--gold-deep)]">This booking is already confirmed.</p>
        {appointment ? (
          <p className="text-sm text-[var(--ink-soft)]">
            {appointment.title} · {appointment.whenLabel}
          </p>
        ) : null}
        <Link href="/book-now" className="btn btn-gold">
          Book another visit
        </Link>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700">{error || "This payment link is invalid or expired."}</p>
        <Link href="/book-now" className="btn btn-gold">
          Book again
        </Link>
      </div>
    );
  }

  const todayKey = zonedParts(new Date(), timezone).dateKey;

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          Payment required
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{appointment.title}</h2>
        <p className="mt-3 text-lg text-[var(--ink-soft)]">{appointment.whenLabel}</p>
        {appointment.staffName ? (
          <p className="mt-1 text-sm text-[var(--ink-soft)]">With {appointment.staffName}</p>
        ) : null}
        <p className="mt-4 text-sm font-medium">Amount due now · {appointment.amountDueLabel}</p>
      </div>

      {slotAvailable ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-soft)]">
            Your selected time is still available. Continue to secure payment to confirm the booking.
          </p>
          <button type="button" className="btn btn-gold" disabled={busy} onClick={() => void continueToPay()}>
            {busy ? "Opening checkout…" : "Continue to payment"}
          </button>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-[var(--line)] p-6">
          <div>
            <h3 className="text-lg font-semibold">That time is no longer available</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Pick a new date and time for the same services, then continue to payment.
            </p>
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
                      onClick={() => {
                        setSelectedDay(key);
                        setSelectedStart("");
                        setSelectedStaffId(null);
                        setError("");
                      }}
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
                        const active =
                          selectedStart === slot.start &&
                          (selectedStaffId ?? null) === (slot.staffId ?? null);
                        return (
                          <button
                            key={`${slot.start}-${slot.staffId || "any"}`}
                            type="button"
                            onClick={() => {
                              setSelectedStart(slot.start);
                              setSelectedStaffId(slot.staffId ?? null);
                            }}
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
            onClick={() => void confirmNewTimeAndPay()}
          >
            {busy ? "Saving…" : "Confirm new time & pay"}
          </button>
        </div>
      )}
    </div>
  );
}
