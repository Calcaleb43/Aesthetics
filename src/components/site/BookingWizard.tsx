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
  variants?: BookableService[];
  hasVariants?: boolean;
  fromPriceCents?: number;
  fromPriceLabel?: string;
};

type BookableCategory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  services: BookableService[];
};

type BookableAddon = BookableService & {
  categoryIds: string[];
};

type ResolvedLine = {
  serviceId: string;
  variantId: string | null;
  title: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number | null;
  paymentMode: string;
  priceLabel: string;
  categoryTitle?: string;
};

type Slot = { start: string; end: string; staffId?: string | null; staffName?: string | null };

type StepName = "Services" | "Add-ons" | "Date" | "Time" | "Details" | "Review" | "Pay";

const ALL_STEPS: StepName[] = ["Services", "Add-ons", "Date", "Time", "Details", "Review", "Pay"];

function serviceHasVariants(s: BookableService) {
  return Boolean(s.hasVariants || (s.variants && s.variants.length > 0));
}

export function BookingWizard({
  initialSlug,
  timezone = "America/Toronto",
}: {
  initialSlug?: string;
  timezone?: string;
}) {
  const [categories, setCategories] = useState<BookableCategory[]>([]);
  const [allAddons, setAllAddons] = useState<BookableAddon[]>([]);
  const [hstRateBps, setHstRateBps] = useState(1300);
  const [enabled, setEnabled] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string[]>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");
  const [slotStaffId, setSlotStaffId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const allServices = useMemo(
    () => categories.flatMap((c) => c.services.map((s) => ({ ...s, categoryId: c.id, categoryTitle: c.title }))),
    [categories],
  );

  const selectedServices = useMemo(
    () => allServices.filter((s) => selectedServiceIds.includes(s.id)),
    [allServices, selectedServiceIds],
  );

  const bookingItems = useMemo(
    () =>
      selectedServices.map((s) => ({
        serviceId: s.id,
        variantIds: serviceHasVariants(s) ? selectedVariantIds[s.id] || [] : [],
      })),
    [selectedServices, selectedVariantIds],
  );

  const selectionComplete = useMemo(
    () =>
      selectedServices.length > 0 &&
      selectedServices.every((s) => !serviceHasVariants(s) || (selectedVariantIds[s.id] || []).length > 0),
    [selectedServices, selectedVariantIds],
  );

  const serviceLines = useMemo(() => {
    const lines: ResolvedLine[] = [];
    for (const s of selectedServices) {
      if (serviceHasVariants(s)) {
        const ids = selectedVariantIds[s.id] || [];
        for (const vid of ids) {
          const v = (s.variants || []).find((x) => x.id === vid);
          if (!v) continue;
          lines.push({
            serviceId: s.id,
            variantId: v.id,
            title: `${s.title}: ${v.title}`,
            durationMinutes: v.durationMinutes,
            priceCents: v.priceCents,
            depositCents: v.depositCents,
            paymentMode: v.paymentMode,
            priceLabel: v.priceLabel,
            categoryTitle: s.categoryTitle,
          });
        }
      } else {
        lines.push({
          serviceId: s.id,
          variantId: null,
          title: s.title,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          depositCents: s.depositCents,
          paymentMode: s.paymentMode,
          priceLabel: s.priceLabel,
          categoryTitle: s.categoryTitle,
        });
      }
    }
    return lines;
  }, [selectedServices, selectedVariantIds]);

  const selectedCategoryIds = useMemo(
    () => [...new Set(selectedServices.map((s) => s.categoryId))],
    [selectedServices],
  );

  const eligibleAddons = useMemo(
    () =>
      allAddons.filter(
        (a) => !a.categoryIds.length || a.categoryIds.some((id) => selectedCategoryIds.includes(id)),
      ),
    [allAddons, selectedCategoryIds],
  );

  const selectedAddons = useMemo(
    () => eligibleAddons.filter((a) => selectedAddonIds.includes(a.id)),
    [eligibleAddons, selectedAddonIds],
  );

  const showAddonsStep = eligibleAddons.length > 0;
  const steps = useMemo(
    () => (showAddonsStep ? ALL_STEPS : ALL_STEPS.filter((s) => s !== "Add-ons")),
    [showAddonsStep],
  );

  const stepName = steps[step] || "Services";

  const totals = useMemo(() => {
    const lines = [...serviceLines, ...selectedAddons];
    if (!lines.length) {
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
    const charge = multiChargeBreakdown(lines, hstRateBps);
    return {
      durationMinutes: lines.reduce((sum, s) => sum + s.durationMinutes, 0),
      priceCents: charge.priceCents,
      depositCents: charge.depositCents,
      paymentMode: charge.paymentMode,
      baseCents: charge.baseCents,
      taxCents: charge.taxCents,
      totalCents: charge.totalCents,
      titles: lines.map((s) => s.title).join(", "),
    };
  }, [serviceLines, selectedAddons, hstRateBps]);

  const appointmentLabel = useMemo(() => {
    if (!slotStart) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(slotStart));
  }, [slotStart, timezone]);

  function setStepIndex(next: number) {
    const clamped = Math.max(0, Math.min(next, steps.length - 1));
    setStep(clamped);
    setFurthest((f) => Math.max(f, clamped));
    setError("");
  }

  function goToStepName(name: StepName) {
    const idx = steps.indexOf(name);
    if (idx >= 0) setStepIndex(idx);
  }

  function goBack() {
    if (step > 0) setStepIndex(step - 1);
  }

  function goForward() {
    if (step >= steps.length - 1) return;
    if (!canLeaveStep(stepName)) return;
    setStepIndex(step + 1);
  }

  function canLeaveStep(name: StepName) {
    if (name === "Services") {
      if (!selectedServiceIds.length) {
        setError("Select at least one service.");
        return false;
      }
      if (!selectionComplete) {
        setError("Choose at least one option for each selected service.");
        return false;
      }
    }
    if (name === "Date" && !selectedDay) {
      setError("Pick a date to continue.");
      return false;
    }
    if (name === "Time" && !slotStart) {
      setError("Pick a time to continue.");
      return false;
    }
    if (name === "Details") {
      if (!name.trim() || !email.trim()) {
        setError("Name and email are required.");
        return false;
      }
      if (!policyAccepted) {
        setError("Please agree to the studio policies before continuing.");
        return false;
      }
    }
    if ((name === "Review" || name === "Pay") && (!selectionComplete || !slotStart)) {
      setError("Complete earlier steps first.");
      return false;
    }
    setError("");
    return true;
  }

  function canJumpTo(index: number) {
    if (index === step) return false;
    if (index < step) return true;
    if (index > furthest) return false;
    const target = steps[index];
    if (target === "Add-ons" || target === "Date" || target === "Time" || target === "Details" || target === "Review" || target === "Pay") {
      if (!selectionComplete) return false;
    }
    if (target === "Time" || target === "Details" || target === "Review" || target === "Pay") {
      if (!selectedDay) return false;
    }
    if (target === "Details" || target === "Review" || target === "Pay") {
      if (!slotStart) return false;
    }
    if (target === "Review" || target === "Pay") {
      if (!name.trim() || !email.trim() || !policyAccepted) return false;
    }
    return true;
  }

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
          setAllAddons([]);
          return;
        }
        setEnabled(data.enabled !== false);
        setHstRateBps(data.hstRateBps ?? 1300);
        const list = (data.categories || []) as BookableCategory[];
        setCategories(list);
        setAllAddons((data.addons || []) as BookableAddon[]);
        if (initialSlug) {
          const matchService = list.flatMap((c) => c.services).find((s) => s.slug === initialSlug);
          const matchCat = list.find((c) => c.slug === initialSlug);
          if (matchService) setSelectedServiceIds([matchService.id]);
          else if (matchCat?.services[0]) setSelectedServiceIds([matchCat.services[0].id]);
        }
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
    if (!selectionComplete || !selectedDay) {
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
          items: JSON.stringify(bookingItems),
        });
        if (selectedAddonIds.length) params.set("addonIds", selectedAddonIds.join(","));
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
  }, [selectionComplete, bookingItems, selectedAddonIds, selectedDay]);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || normalized.length < 5) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/booking/client-lookup?email=${encodeURIComponent(normalized)}`);
        const data = await res.json();
        if (!data.found) return;
        if (!nameDirty && data.name) setName(data.name);
        if (!phoneDirty && data.phone) setPhone(data.phone);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [email, nameDirty, phoneDirty]);

  useEffect(() => {
    setSelectedAddonIds((prev) => prev.filter((id) => eligibleAddons.some((a) => a.id === id)));
  }, [eligibleAddons]);

  // Keep step index valid if Add-ons disappears from the flow
  useEffect(() => {
    if (step >= steps.length) setStepIndex(steps.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  function toggleCategory(id: string) {
    setExpandedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    setSelectedVariantIds((prev) => {
      if (prev[id]) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
    setSelectedDay(null);
    setSlotStart("");
    setSlotStaffId(null);
    setFurthest(0);
  }

  function toggleVariant(serviceId: string, variantId: string) {
    const current = selectedVariantIds[serviceId] || [];
    const nextVariants = current.includes(variantId)
      ? current.filter((id) => id !== variantId)
      : [...current, variantId];

    if (!nextVariants.length) {
      setSelectedServiceIds((ids) => ids.filter((id) => id !== serviceId));
      setSelectedVariantIds((prev) => {
        const { [serviceId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setSelectedServiceIds((ids) => (ids.includes(serviceId) ? ids : [...ids, serviceId]));
      setSelectedVariantIds((prev) => ({ ...prev, [serviceId]: nextVariants }));
    }
    setSelectedDay(null);
    setSlotStart("");
    setSlotStaffId(null);
    setFurthest(0);
  }

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSelectedDay(null);
    setSlotStart("");
    setSlotStaffId(null);
    setFurthest((f) => Math.min(f, steps.indexOf("Add-ons")));
  }

  function selectDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDay(key);
    setSlotStart("");
    setSlotStaffId(null);
    setError("");
    const timeIdx = steps.indexOf("Time");
    setStepIndex(timeIdx);
  }

  function selectSlot(slot: Slot) {
    setSlotStart(slot.start);
    setSlotStaffId(slot.staffId ?? null);
    setError("");
    setStepIndex(steps.indexOf("Details"));
  }

  function submitCheckout() {
    if (!selectionComplete || !slotStart) return;
    if (!canLeaveStep("Review") && stepName !== "Pay") return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/booking/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: bookingItems,
            addonIds: selectedAddonIds,
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

  function NavFooter({
    continueLabel = "Continue",
    onContinue,
    continueDisabled,
  }: {
    continueLabel?: string;
    onContinue?: () => void;
    continueDisabled?: boolean;
  }) {
    return (
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/10 pt-6">
        {step > 0 ? (
          <button type="button" className="btn" onClick={goBack}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-gold"
          disabled={continueDisabled}
          onClick={() => {
            if (onContinue) onContinue();
            else goForward();
          }}
        >
          {continueLabel}
        </button>
      </div>
    );
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
        {steps.map((label, i) => {
          const active = i === step;
          const reachable = i === step || canJumpTo(i) || i < step;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => {
                  if (i === step) return;
                  if (i < step) {
                    setStepIndex(i);
                    return;
                  }
                  if (canJumpTo(i)) setStepIndex(i);
                }}
                className={`rounded-full px-3 py-1 transition ${
                  active
                    ? "bg-black text-white"
                    : reachable
                      ? "bg-black/10 text-black hover:bg-black/20"
                      : "cursor-not-allowed bg-black/5 text-black/35"
                }`}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      {stepName === "Services" && (
        <div>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            Select one or more services. If a service has options (size/area), choose one or more.
          </p>
          <div className="grid gap-3">
            {categories.map((c) => {
              const open = expandedCategoryIds.includes(c.id);
              const selectedInCategory = c.services.filter((s) => selectedServiceIds.includes(s.id)).length;
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-black/10">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleCategory(c.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-black/[0.03]"
                  >
                    <div className="min-w-0">
                      <h3 className="display text-xl md:text-2xl">{c.title}</h3>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {c.services.length} service{c.services.length === 1 ? "" : "s"}
                        {selectedInCategory
                          ? ` · ${selectedInCategory} selected`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-lg text-black/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    >
                      ▾
                    </span>
                  </button>
                  {open ? (
                    <div className="grid gap-3 border-t border-black/10 px-4 py-4 sm:px-5">
                      {c.services.map((s) => {
                        const hasVariants = serviceHasVariants(s);
                        const active = selectedServiceIds.includes(s.id);
                        const chosenVariants = selectedVariantIds[s.id] || [];
                        if (hasVariants) {
                          return (
                            <div
                              key={s.id}
                              className={`rounded-2xl border px-5 py-4 ${
                                active ? "border-black bg-black text-white" : "border-black/15"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold tracking-wide">{s.title}</p>
                                  <p className={`mt-1 text-sm ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                                    Choose one or more · {s.priceLabel}
                                  </p>
                                </div>
                                <span
                                  className={`text-xs uppercase tracking-[0.14em] ${active ? "text-white/80" : "text-black/40"}`}
                                >
                                  {chosenVariants.length ? `${chosenVariants.length} selected` : "Options"}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2">
                                {(s.variants || []).map((v) => {
                                  const on = chosenVariants.includes(v.id);
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => toggleVariant(s.id, v.id)}
                                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                                        on
                                          ? active
                                            ? "border-white/40 bg-white/10"
                                            : "border-black bg-black text-white"
                                          : active
                                            ? "border-white/20 hover:border-white/40"
                                            : "border-black/10 hover:border-black/30"
                                      }`}
                                    >
                                      <span className="font-medium">{v.title}</span>
                                      <span className={`mt-0.5 block text-xs ${on || active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                                        {v.durationMinutes} min · {v.priceLabel}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
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
                              <span
                                className={`text-xs uppercase tracking-[0.14em] ${active ? "text-white/80" : "text-black/40"}`}
                              >
                                {active ? "Selected" : "Select"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {serviceLines.length ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              {serviceLines.length} option{serviceLines.length === 1 ? "" : "s"} ·{" "}
              {serviceLines.reduce((n, l) => n + l.durationMinutes, 0)} min ·{" "}
              {formatCad(serviceLines.reduce((n, l) => n + l.priceCents, 0))}
            </p>
          ) : null}
          <NavFooter continueLabel="Continue" onContinue={goForward} continueDisabled={!selectionComplete} />
        </div>
      )}

      {stepName === "Add-ons" && (
        <div>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">Optional add-ons for your visit. You can skip this step.</p>
          <div className="grid gap-3">
            {eligibleAddons.map((a) => {
              const active = selectedAddonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className={`rounded-2xl border px-5 py-4 text-left transition ${
                    active ? "border-black bg-black text-white" : "border-black/15 hover:border-black/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold tracking-wide">{a.title}</p>
                      {a.summary ? (
                        <p className={`mt-1 text-sm ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                          {a.summary}
                        </p>
                      ) : null}
                      <p className={`mt-1 text-sm ${active ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                        {a.durationMinutes > 0 ? `${a.durationMinutes} min · ` : ""}
                        {a.priceLabel}
                      </p>
                    </div>
                    <span className={`text-xs uppercase tracking-[0.14em] ${active ? "text-white/80" : "text-black/40"}`}>
                      {active ? "Added" : "Add"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <NavFooter
            continueLabel={selectedAddonIds.length ? "Continue" : "Skip add-ons"}
            onContinue={goForward}
          />
        </div>
      )}

      {stepName === "Date" && (
        <div>
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
          <NavFooter
            continueLabel="Continue"
            continueDisabled={!selectedDay}
            onContinue={() => {
              if (!selectedDay) {
                setError("Pick a date to continue.");
                return;
              }
              goForward();
            }}
          />
        </div>
      )}

      {stepName === "Time" && selectedDay && (
        <div>
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
                const active = slotStart === slot.start && (slotStaffId ?? null) === (slot.staffId ?? null);
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
          <NavFooter
            continueLabel="Continue"
            continueDisabled={!slotStart}
            onContinue={() => {
              if (!slotStart) {
                setError("Pick a time to continue.");
                return;
              }
              goForward();
            }}
          />
        </div>
      )}

      {stepName === "Details" && (
        <div className="grid max-w-xl gap-4">
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
          <NavFooter continueLabel="Review booking" onContinue={goForward} />
        </div>
      )}

      {stepName === "Review" && selectionComplete && slotStart && (
        <div className="max-w-2xl">
          <h3 className="display text-2xl md:text-3xl">Review your booking</h3>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Confirm services, add-ons, and details before payment.
          </p>

          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Services</h4>
                <button type="button" className="text-sm underline" onClick={() => goToStepName("Services")}>
                  Edit
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {serviceLines.map((s) => (
                  <li key={`${s.serviceId}-${s.variantId || "base"}`} className="flex items-start justify-between gap-3">
                    <span>
                      {s.title}
                      {s.categoryTitle ? (
                        <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{s.categoryTitle}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[var(--ink-soft)]">
                      {s.durationMinutes} min · {s.priceLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Add-ons</h4>
                {showAddonsStep ? (
                  <button type="button" className="text-sm underline" onClick={() => goToStepName("Add-ons")}>
                    Edit
                  </button>
                ) : null}
              </div>
              {selectedAddons.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {selectedAddons.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3">
                      <span>{a.title}</span>
                      <span className="shrink-0 text-[var(--ink-soft)]">
                        {a.durationMinutes > 0 ? `${a.durationMinutes} min · ` : ""}
                        {a.priceLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">No add-ons selected.</p>
              )}
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Date &amp; time</h4>
                <button type="button" className="text-sm underline" onClick={() => goToStepName("Date")}>
                  Edit
                </button>
              </div>
              <p className="mt-3 text-sm">{appointmentLabel}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{totals.durationMinutes} min total</p>
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Your details</h4>
                <button type="button" className="text-sm underline" onClick={() => goToStepName("Details")}>
                  Edit
                </button>
              </div>
              <p className="mt-3 text-sm">{name}</p>
              <p className="text-sm text-[var(--ink-soft)]">{email}</p>
              {phone ? <p className="text-sm text-[var(--ink-soft)]">{phone}</p> : null}
              {notes ? <p className="mt-2 text-sm text-[var(--ink-soft)]">Notes: {notes}</p> : null}
            </section>

            <section className="rounded-2xl border border-black/10 bg-[var(--bg-deep)] p-5">
              <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Payment summary</h4>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  Services &amp; add-ons total: <strong>{formatCad(totals.priceCents)}</strong>
                </p>
                {totals.paymentMode === "deposit" ? (
                  <>
                    <p>
                      Due now (deposit + HST): <strong>{formatCad(totals.totalCents)}</strong>
                    </p>
                    <p className="text-[var(--ink-soft)]">
                      Remaining at appointment:{" "}
                      {formatCad(Math.max(0, totals.priceCents - (totals.depositCents || 0)))} + tax
                    </p>
                  </>
                ) : totals.paymentMode === "full" ? (
                  <p>
                    Due now (full + HST): <strong>{formatCad(totals.totalCents)}</strong>
                  </p>
                ) : (
                  <p>No online payment required for this booking.</p>
                )}
              </div>
            </section>
          </div>

          <NavFooter continueLabel="Continue to payment" onContinue={goForward} />
        </div>
      )}

      {stepName === "Pay" && selectionComplete && slotStart && (
        <div className="max-w-xl rounded-2xl border border-black/10 p-6">
          <h3 className="display text-2xl">Confirm &amp; pay</h3>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {serviceLines.length} item{serviceLines.length === 1 ? "" : "s"}
            {selectedAddons.length
              ? ` · ${selectedAddons.length} add-on${selectedAddons.length === 1 ? "" : "s"}`
              : ""}{" "}
            · {totals.durationMinutes} min
          </p>
          <p className="mt-3 text-sm">{appointmentLabel}</p>
          <div className="mt-6 space-y-1 text-sm">
            {totals.paymentMode === "deposit" ? (
              <p>
                Charging now: <strong>{formatCad(totals.totalCents)}</strong> (deposit + HST)
              </p>
            ) : totals.paymentMode === "full" ? (
              <p>
                Charging now: <strong>{formatCad(totals.totalCents)}</strong> (full + HST)
              </p>
            ) : (
              <p>No charge today — your booking will be confirmed immediately.</p>
            )}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" className="btn" onClick={goBack}>
              Back to review
            </button>
            <button type="button" className="btn btn-gold" disabled={pending} onClick={submitCheckout}>
              {pending
                ? "Redirecting…"
                : totals.paymentMode === "none" || totals.totalCents <= 0
                  ? "Confirm booking"
                  : "Pay & book"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
