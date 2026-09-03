"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { formatCad } from "@/lib/booking/money";

type BookableService = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  priceLabel: string;
  chargeLabel: string;
  chargeBaseLabel: string;
  taxLabel: string;
  chargeTotalCents: number;
};

type Slot = { start: string; end: string };

const steps = ["Service", "Date", "Time", "Details", "Pay"] as const;

export function BookingWizard({
  initialSlug,
  timezone = "America/Toronto",
}: {
  initialSlug?: string;
  timezone?: string;
}) {
  const [services, setServices] = useState<BookableService[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceId, setServiceId] = useState<string>("");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = services.find((s) => s.id === serviceId) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/booking/services");
        const data = await res.json();
        if (cancelled) return;
        setEnabled(data.enabled !== false);
        const list = (data.services || []) as BookableService[];
        setServices(list);
        const match = list.find((s) => s.slug === initialSlug) || list[0];
        if (match) setServiceId(match.id);
      } catch {
        if (!cancelled) setError("Could not load bookable services.");
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSlug]);

  useEffect(() => {
    if (!serviceId || !selectedDay) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setError("");
      try {
        const day = parseISO(`${selectedDay}T12:00:00`);
        const from = day.toISOString();
        const to = addDays(day, 1).toISOString();
        const res = await fetch(
          `/api/booking/availability?serviceId=${encodeURIComponent(serviceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not load availability");
          setSlots([]);
          return;
        }
        setSlots(data.slots || []);
      } catch {
        if (!cancelled) setError("Could not load availability");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, selectedDay]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  async function loadMonthAvailabilityHint() {
    // Soft-load: mark days that have at least one slot when service selected
  }

  useEffect(() => {
    void loadMonthAvailabilityHint;
  }, [serviceId, month]);

  function selectService(id: string) {
    setServiceId(id);
    setSelectedDay(null);
    setSlotStart("");
    setStep(1);
  }

  function selectDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDay(key);
    setSlotStart("");
    setStep(2);
  }

  function selectSlot(start: string) {
    setSlotStart(start);
    setStep(3);
  }

  function goPay() {
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!policyAccepted) {
      setError("Please agree to the studio policies before booking.");
      return;
    }
    setStep(4);
  }

  function submitCheckout() {
    if (!selected || !slotStart) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/booking/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: selected.id,
            startsAt: slotStart,
            clientName: name,
            clientEmail: email,
            clientPhone: phone || null,
            notes: notes || null,
            policyAccepted: true,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.checkoutUrl) {
          setError(data.error || "Checkout failed");
          return;
        }
        window.location.href = data.checkoutUrl;
      } catch {
        setError("Checkout failed. Please try again.");
      }
    });
  }

  if (loadingServices) {
    return <p className="mt-10 text-sm text-[var(--ink-soft)]">Loading booking…</p>;
  }

  if (!enabled) {
    return (
      <p className="mt-10 text-sm text-[var(--ink-soft)]">
        Online booking is temporarily unavailable. Please contact the studio or use the external booking link in
        Settings.
      </p>
    );
  }

  if (!services.length) {
    return <p className="mt-10 text-sm text-[var(--ink-soft)]">No bookable services are published yet.</p>;
  }

  return (
    <div className="mt-10">
      <ol className="mb-8 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${i === step ? "bg-black text-white" : i < step ? "bg-black/10 text-black" : "bg-black/5"}`}
          >
            {label}
          </li>
        ))}
      </ol>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      {step === 0 && (
        <div className="grid gap-3">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectService(s.id)}
              className={`rounded-2xl border px-5 py-4 text-left transition ${
                serviceId === s.id ? "border-black bg-black text-white" : "border-black/15 hover:border-black/40"
              }`}
            >
              <p className="font-semibold tracking-wide">{s.title}</p>
              <p className={`mt-1 text-sm ${serviceId === s.id ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                {s.durationMinutes} min · from {s.priceLabel}
                {s.paymentMode === "deposit"
                  ? ` · deposit ${s.chargeLabel}`
                  : s.paymentMode === "full"
                    ? ` · pay ${s.chargeLabel}`
                    : " · no online payment"}
              </p>
            </button>
          ))}
        </div>
      )}

      {step === 1 && selected && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button type="button" className="text-sm underline" onClick={() => setStep(0)}>
              Change service
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.12em]"
                onClick={() => setMonth(startOfMonth(addDays(month, -15)))}
              >
                Prev
              </button>
              <p className="min-w-[9rem] text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
              <button
                type="button"
                className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.12em]"
                onClick={() => setMonth(startOfMonth(addDays(endOfMonth(month), 1)))}
              >
                Next
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {daysInMonth.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const active = selectedDay === key;
              const past = day < new Date(new Date().toDateString());
              return (
                <button
                  key={key}
                  type="button"
                  disabled={past}
                  onClick={() => selectDay(day)}
                  className={`aspect-square rounded-xl text-sm transition ${
                    active
                      ? "bg-black text-white"
                      : past
                        ? "cursor-not-allowed text-black/25"
                        : "border border-black/10 hover:border-black/40"
                  }`}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-[var(--ink-soft)]">Times shown in {timezone.replace(/_/g, " ")}.</p>
        </div>
      )}

      {step === 2 && selected && selectedDay && (
        <div>
          <button type="button" className="mb-4 text-sm underline" onClick={() => setStep(1)}>
            Change date
          </button>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            {format(parseISO(`${selectedDay}T12:00:00`), "EEEE, MMMM d")} · {selected.title}
          </p>
          {loadingSlots ? (
            <p className="text-sm text-[var(--ink-soft)]">Loading times…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No open times this day. Pick another date.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((slot) => {
                const label = new Intl.DateTimeFormat("en-CA", {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(slot.start));
                const active = slotStart === slot.start;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => selectSlot(slot.start)}
                    className={`rounded-xl px-3 py-3 text-sm transition ${
                      active ? "bg-black text-white" : "border border-black/15 hover:border-black/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 3 && selected && slotStart && (
        <div className="grid max-w-xl gap-4">
          <button type="button" className="w-fit text-sm underline" onClick={() => setStep(2)}>
            Change time
          </button>
          <label className="grid gap-1 text-sm">
            Full name
            <input className="admin-input !bg-white !text-black" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input
              type="email"
              className="admin-input !bg-white !text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Phone
            <input className="admin-input !bg-white !text-black" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Notes (optional)
            <textarea
              className="admin-input !bg-white !text-black"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1"
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
            />
            <span>
              I have read and agree to the studio{" "}
              <Link href="/policies" className="underline" target="_blank">
                Policies &amp; Client Agreement
              </Link>
              . Booking fees/deposits are non-refundable and applied toward the service; any remaining balance is due at
              the appointment.
            </span>
          </label>
          <button type="button" className="btn btn-gold w-fit" onClick={goPay}>
            Review &amp; continue
          </button>
        </div>
      )}

      {step === 4 && selected && slotStart && (
        <div className="max-w-xl rounded-2xl border border-black/10 p-6">
          <button type="button" className="mb-4 text-sm underline" onClick={() => setStep(3)}>
            Edit details
          </button>
          <h3 className="display text-2xl">{selected.title}</h3>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {new Intl.DateTimeFormat("en-CA", {
              timeZone: timezone,
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date(slotStart))}{" "}
            · {selected.durationMinutes} min
          </p>
          <p className="mt-2 text-sm">{name}</p>
          <p className="text-sm text-[var(--ink-soft)]">{email}</p>
          <div className="mt-6 space-y-1 text-sm">
            <p>
              Service price: <strong>{selected.priceLabel}</strong>
            </p>
            {selected.paymentMode === "deposit" ? (
              <p>
                Due now (deposit + HST): <strong>{selected.chargeLabel}</strong>
              </p>
            ) : selected.paymentMode === "full" ? (
              <p>
                Due now (full + HST): <strong>{selected.chargeLabel}</strong>
              </p>
            ) : (
              <p>No online payment required for this service.</p>
            )}
            {selected.paymentMode !== "none" && selected.paymentMode === "deposit" ? (
              <p className="text-[var(--ink-soft)]">
                Remaining balance due at appointment:{" "}
                {formatCad(Math.max(0, selected.priceCents - (selected.depositCents || 0)))} + tax
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-gold mt-8" disabled={pending} onClick={submitCheckout}>
            {pending
              ? "Redirecting…"
              : selected.paymentMode === "none" || selected.chargeTotalCents <= 0
                ? "Confirm booking"
                : "Pay & book"}
          </button>
        </div>
      )}
    </div>
  );
}
