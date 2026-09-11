"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { formatCad, multiChargeBreakdown } from "@/lib/booking/money";

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

type BookableCategory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  services: BookableService[];
};

type Slot = { start: string; end: string; staffId?: string | null; staffName?: string | null };

const steps = ["Category", "Services", "Date", "Time", "Details", "Pay"] as const;

export function BookingWizard({
  initialSlug,
  timezone = "America/Toronto",
}: {
  initialSlug?: string;
  timezone?: string;
}) {
  const [categories, setCategories] = useState<BookableCategory[]>([]);
  const [hstRateBps, setHstRateBps] = useState(1300);
  const [enabled, setEnabled] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");
  const [slotStaffId, setSlotStaffId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const category = categories.find((c) => c.id === categoryId) || null;
  const selectedServices = useMemo(
    () => (category?.services || []).filter((s) => selectedServiceIds.includes(s.id)),
    [category, selectedServiceIds],
  );

  const totals = useMemo(() => {
    if (!selectedServices.length) {
      return {
        durationMinutes: 0,
        priceCents: 0,
        depositCents: null as number | null,
        paymentMode: "none",
        baseCents: 0,
        taxCents: 0,
        totalCents: 0,
        titles: "",
      };
    }
    const charge = multiChargeBreakdown(selectedServices, hstRateBps);
    return {
      durationMinutes: selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
      priceCents: charge.priceCents,
      depositCents: charge.depositCents,
      paymentMode: charge.paymentMode,
      baseCents: charge.baseCents,
      taxCents: charge.taxCents,
      totalCents: charge.totalCents,
      titles: selectedServices.map((s) => s.title).join(", "),
    };
  }, [selectedServices, hstRateBps]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/booking/services");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setEnabled(false);
          setError(data.error || "Booking is unavailable right now.");
          setCategories([]);
          return;
        }
        setEnabled(data.enabled !== false);
        setHstRateBps(data.hstRateBps ?? 1300);
        const list = (data.categories || []) as BookableCategory[];
        setCategories(list);
        const match =
          list.find((c) => c.slug === initialSlug) ||
          list.find((c) => c.services.some((s) => s.slug === initialSlug)) ||
          list[0];
        if (match) setCategoryId(match.id);
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
    if (!selectedServiceIds.length || !selectedDay) {
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
        const params = new URLSearchParams({
          from,
          to,
          serviceIds: selectedServiceIds.join(","),
        });
        const res = await fetch(`/api/booking/availability?${params}`);
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
  }, [selectedServiceIds, selectedDay]);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || normalized.length < 5) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/booking/client-lookup?email=${encodeURIComponent(normalized)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data.found) return;
        if (!nameDirty && data.name) setName(data.name);
        if (!phoneDirty && data.phone) setPhone(data.phone);
      } catch {
        /* ignore lookup errors */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [email, nameDirty, phoneDirty]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  function selectCategory(id: string) {
    setCategoryId(id);
    setSelectedServiceIds([]);
    setSelectedDay(null);
    setSlotStart("");
    setSlotStaffId(null);
    setStep(1);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedDay(null);
    setSlotStart("");
    setSlotStaffId(null);
  }

  function continueFromServices() {
    if (!selectedServiceIds.length) {
      setError("Select at least one service.");
      return;
    }
    setError("");
    setStep(2);
  }

  function selectDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDay(key);
    setSlotStart("");
    setSlotStaffId(null);
    setStep(3);
  }

  function selectSlot(slot: Slot) {
    setSlotStart(slot.start);
    setSlotStaffId(slot.staffId ?? null);
    setStep(4);
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
    setStep(5);
  }

  function submitCheckout() {
    if (!category || !selectedServiceIds.length || !slotStart) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/booking/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: category.id,
            serviceIds: selectedServiceIds,
            startsAt: slotStart,
            staffId: slotStaffId,
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

  if (!categories.length) {
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
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCategory(c.id)}
              className={`rounded-2xl border px-5 py-4 text-left transition ${
                categoryId === c.id ? "border-black bg-black text-white" : "border-black/15 hover:border-black/40"
              }`}
            >
              <p className="font-semibold tracking-wide">{c.title}</p>
              <p className={`mt-1 text-sm ${categoryId === c.id ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                {c.services.length} service{c.services.length === 1 ? "" : "s"} available
              </p>
            </button>
          ))}
        </div>
      )}

      {step === 1 && category && (
        <div>
          <button type="button" className="mb-4 text-sm underline" onClick={() => setStep(0)}>
            Change category
          </button>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            Select one or more {category.title} services for this visit.
          </p>
          <div className="grid gap-3">
            {category.services.map((s) => {
              const active = selectedServiceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`rounded-2xl border px-5 py-4 text-left transition ${
                    active ? "border-black bg-black text-white" : "border-black/15 hover:border-black/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold tracking-wide">{s.title}</p>
                      <p className={`mt-1 text-sm ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                        {s.durationMinutes} min · {s.priceLabel}
                        {s.paymentMode === "deposit"
                          ? ` · deposit ${s.chargeLabel}`
                          : s.paymentMode === "full"
                            ? ` · pay ${s.chargeLabel}`
                            : " · no online payment"}
                      </p>
                    </div>
                    <span className={`text-xs uppercase tracking-[0.14em] ${active ? "text-white/80" : "text-black/40"}`}>
                      {active ? "Selected" : "Select"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedServices.length ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              {selectedServices.length} selected · {totals.durationMinutes} min · from {formatCad(totals.priceCents)}
            </p>
          ) : null}
          <button type="button" className="btn btn-gold mt-6" onClick={continueFromServices}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && selectedServices.length > 0 && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="self-start text-sm underline" onClick={() => setStep(1)}>
              Change services
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-black/20 px-3 text-xs uppercase tracking-[0.12em]"
                onClick={() => setMonth(startOfMonth(addDays(month, -15)))}
              >
                Prev
              </button>
              <p className="min-w-0 flex-1 text-center text-sm font-semibold sm:min-w-[9rem] sm:flex-none">
                {format(month, "MMMM yyyy")}
              </p>
              <button
                type="button"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-black/20 px-3 text-xs uppercase tracking-[0.12em]"
                onClick={() => setMonth(startOfMonth(addDays(endOfMonth(month), 1)))}
              >
                Next
              </button>
            </div>
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
              const past = day < new Date(new Date().toDateString());
              return (
                <button
                  key={key}
                  type="button"
                  disabled={past}
                  onClick={() => selectDay(day)}
                  className={`aspect-square min-h-10 rounded-xl text-sm transition sm:min-h-0 ${
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

      {step === 3 && selectedServices.length > 0 && selectedDay && (
        <div>
          <button type="button" className="mb-4 text-sm underline" onClick={() => setStep(2)}>
            Change date
          </button>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            {format(parseISO(`${selectedDay}T12:00:00`), "EEEE, MMMM d")} · {totals.titles} · {totals.durationMinutes}{" "}
            min
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
                const active =
                  slotStart === slot.start && (slotStaffId ?? null) === (slot.staffId ?? null);
                return (
                  <button
                    key={`${slot.start}-${slot.staffId || "any"}`}
                    type="button"
                    onClick={() => selectSlot(slot)}
                    className={`rounded-xl px-3 py-3 text-sm transition ${
                      active ? "bg-black text-white" : "border border-black/15 hover:border-black/40"
                    }`}
                  >
                    {label}
                    {slot.staffName ? (
                      <span className={`mt-1 block text-xs ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                        {slot.staffName}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 4 && selectedServices.length > 0 && slotStart && (
        <div className="grid max-w-xl gap-4">
          <button type="button" className="w-fit text-sm underline" onClick={() => setStep(3)}>
            Change time
          </button>
          <label className="grid gap-1 text-sm">
            Full name
            <input
              className="admin-input !bg-white !text-black"
              value={name}
              onChange={(e) => {
                setNameDirty(true);
                setName(e.target.value);
              }}
              required
            />
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
            <input
              className="admin-input !bg-white !text-black"
              value={phone}
              onChange={(e) => {
                setPhoneDirty(true);
                setPhone(e.target.value);
              }}
            />
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

      {step === 5 && selectedServices.length > 0 && slotStart && (
        <div className="max-w-xl rounded-2xl border border-black/10 p-6">
          <button type="button" className="mb-4 text-sm underline" onClick={() => setStep(4)}>
            Edit details
          </button>
          <h3 className="display text-2xl">{category?.title}</h3>
          <ul className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
            {selectedServices.map((s) => (
              <li key={s.id}>
                {s.title} · {s.durationMinutes} min · {s.priceLabel}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {new Intl.DateTimeFormat("en-CA", {
              timeZone: timezone,
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date(slotStart))}{" "}
            · {totals.durationMinutes} min total
          </p>
          <p className="mt-2 text-sm">{name}</p>
          <p className="text-sm text-[var(--ink-soft)]">{email}</p>
          <div className="mt-6 space-y-1 text-sm">
            <p>
              Services total: <strong>{formatCad(totals.priceCents)}</strong>
            </p>
            {totals.paymentMode === "deposit" ? (
              <p>
                Due now (deposit + HST): <strong>{formatCad(totals.totalCents)}</strong>
              </p>
            ) : totals.paymentMode === "full" ? (
              <p>
                Due now (full + HST): <strong>{formatCad(totals.totalCents)}</strong>
              </p>
            ) : (
              <p>No online payment required for this booking.</p>
            )}
            {totals.paymentMode === "deposit" ? (
              <p className="text-[var(--ink-soft)]">
                Remaining balance due at appointment:{" "}
                {formatCad(Math.max(0, totals.priceCents - (totals.depositCents || 0)))} + tax
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-gold mt-8" disabled={pending} onClick={submitCheckout}>
            {pending
              ? "Redirecting…"
              : totals.paymentMode === "none" || totals.totalCents <= 0
                ? "Confirm booking"
                : "Pay & book"}
          </button>
        </div>
      )}
    </div>
  );
}
