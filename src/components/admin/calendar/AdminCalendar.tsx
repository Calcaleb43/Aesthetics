"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BlockedTimesPanel, type BlockedTimeItem } from "@/components/admin/calendar/BlockedTimesPanel";
import { DayOverridesPanel } from "@/components/admin/calendar/DayOverridesPanel";
import {
  dayKeyFromWeekday,
  type WeeklyHours,
  formatCad,
  estimateBalanceDueCents,
  zonedInputToUtc,
  zonedLocalToUtc,
  zonedParts,
} from "@/lib/booking/money";
import {
  closedRangesForDay,
  effectiveWeeklyHours,
  gridHourBounds,
} from "@/lib/booking/weekly-hours";

type ServiceVariantOption = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  durationMinutes: number;
};

type ServiceOption = {
  id: string;
  title: string;
  slug: string;
  categorySlug?: string;
  categoryTitle?: string;
  variants?: ServiceVariantOption[];
};

type StaffOption = {
  id: string;
  name: string;
  color: string;
  role?: string;
  serviceIds: string[];
  weeklyHours: WeeklyHours | null;
};

type ClientOption = { id: string; name: string; email: string; phone: string | null };

type Appointment = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  clientId: string | null;
  seriesId: string | null;
  groupId?: string | null;
  /** Active (not cancelled) appointments in this party, including this one. */
  groupSize?: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  notes: string;
  paymentMode: string;
  priceCents?: number;
  depositCents?: number | null;
  taxCents?: number;
  discountCents?: number;
  amountChargedCents: number;
  amountLabel: string;
  priceLabel: string;
  balanceDueCents?: number;
  balanceDueLabel?: string | null;
  serviceId: string;
  serviceIds?: string[];
  items?: { serviceId: string; variantIds: string[] }[];
  serviceTitle: string;
  serviceSlug: string;
  serviceLabel: string | null;
  staffId: string | null;
  staffName: string | null;
  staffColor: string;
};

type ViewMode = "month" | "week" | "day" | "list";

type ListRange = "upcoming" | "today" | "next7" | "next30" | "past7" | "past30" | "custom";
type TimeOfDay = "all" | "morning" | "afternoon" | "evening";

const LIST_RANGE_OPTIONS: { id: ListRange; label: string }[] = [
  { id: "upcoming", label: "Upcoming (next 90 days)" },
  { id: "today", label: "Today" },
  { id: "next7", label: "Next 7 days" },
  { id: "next30", label: "Next 30 days" },
  { id: "past7", label: "Past 7 days" },
  { id: "past30", label: "Past 30 days" },
  { id: "custom", label: "Custom dates" },
];

const TIME_OF_DAY_OPTIONS: { id: TimeOfDay; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "morning", label: "Morning (before 12pm)" },
  { id: "afternoon", label: "Afternoon (12–5pm)" },
  { id: "evening", label: "Evening (5pm+)" },
];

function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function studioDayStart(key: string, timeZone: string) {
  const [y, m, d] = key.split("-").map(Number);
  return zonedLocalToUtc(y, m, d, 0, 0, timeZone);
}

/** List view bounds in studio time; `toKeyExclusive` is the day after the last included day. */
function listRangeBounds(range: ListRange, customFrom: string, customTo: string, timeZone: string) {
  const today = zonedParts(new Date(), timeZone).dateKey;
  let fromKey = today;
  let toKeyExclusive = shiftDateKey(today, 1);
  if (range === "upcoming") {
    return { from: new Date(), to: studioDayStart(shiftDateKey(today, 91), timeZone) };
  }
  if (range === "next7") toKeyExclusive = shiftDateKey(today, 7);
  else if (range === "next30") toKeyExclusive = shiftDateKey(today, 30);
  else if (range === "past7") fromKey = shiftDateKey(today, -7);
  else if (range === "past30") fromKey = shiftDateKey(today, -30);
  else if (range === "custom") {
    let a = customFrom || today;
    let b = customTo || a;
    if (b < a) [a, b] = [b, a];
    fromKey = a;
    toKeyExclusive = shiftDateKey(b, 1);
  }
  return {
    from: studioDayStart(fromKey, timeZone),
    to: new Date(studioDayStart(toKeyExclusive, timeZone).getTime() - 1),
  };
}

function matchesTimeOfDay(iso: string, filter: TimeOfDay, timeZone: string) {
  if (filter === "all") return true;
  const hour = zonedParts(new Date(iso), timeZone).hour;
  if (filter === "morning") return hour < 12;
  if (filter === "afternoon") return hour >= 12 && hour < 17;
  return hour >= 17;
}

const STATUS_OPTIONS = [
  { id: "confirmed", label: "Confirmed (paid)" },
  { id: "pending_payment", label: "Unpaid holds" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "no_show", label: "No-show" },
  { id: "all", label: "All (excl. expired)" },
] as const;

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: "completed", label: "Complete" },
  { status: "cancelled", label: "Cancel" },
  { status: "no_show", label: "No-show" },
  { status: "confirmed", label: "Mark confirmed" },
];

/** Calendar cells are browser-local midnights standing in for studio dates; this is their studio date key. */
function calendarKey(day: Date) {
  return format(day, "yyyy-MM-dd");
}

/** UTC instants for studio midnight at the start and end of a calendar day. */
function studioDayBounds(day: Date, timezone: string) {
  const next = addDays(day, 1);
  return {
    start: zonedLocalToUtc(day.getFullYear(), day.getMonth() + 1, day.getDate(), 0, 0, timezone),
    end: zonedLocalToUtc(next.getFullYear(), next.getMonth() + 1, next.getDate(), 0, 0, timezone),
  };
}

function studioAt(day: Date, hour: number, minute: number, timezone: string) {
  return zonedLocalToUtc(day.getFullYear(), day.getMonth() + 1, day.getDate(), hour, minute, timezone);
}

/** Minutes past studio midnight on `dayKey`, clamped to that day. */
function studioMinutesOnDay(iso: string, dayKey: string, timezone: string) {
  const p = zonedParts(new Date(iso), timezone);
  if (p.dateKey < dayKey) return 0;
  if (p.dateKey > dayKey) return 24 * 60;
  return p.hour * 60 + p.minute;
}

function eventStyle(
  startsAt: string,
  endsAt: string,
  dayKey: string,
  timezone: string,
  hourStart: number,
  dayMinutes: number,
) {
  const offset = hourStart * 60;
  const topMin = Math.max(0, studioMinutesOnDay(startsAt, dayKey, timezone) - offset);
  const endMin = Math.min(dayMinutes, studioMinutesOnDay(endsAt, dayKey, timezone) - offset);
  const heightMin = Math.max(20, endMin - topMin);
  return {
    top: `${(topMin / dayMinutes) * 100}%`,
    height: `${(heightMin / dayMinutes) * 100}%`,
  };
}

/** `datetime-local` value showing `date` as studio wall-clock time. */
function toStudioInputValue(date: Date, timezone: string) {
  const p = zonedParts(date, timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.dateKey}T${pad(p.hour)}:${pad(p.minute)}`;
}
function formatWhen(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function moneyInputFromCents(cents: number | null | undefined) {
  if (cents == null || Number.isNaN(cents)) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const dollars = Number(trimmed);
  if (Number.isNaN(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function serviceHasVariants(s: ServiceOption) {
  return Boolean(s.variants && s.variants.length > 0);
}

function emptyFormFields() {
  return {
    serviceIds: [] as string[],
    variantIdsByService: {} as Record<string, string[]>,
    staffId: "",
    clientId: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
    startsAt: "",
    paymentMode: "deposit",
    priceDollars: "",
    depositDollars: "",
    amountPaidDollars: "",
    discountDollars: "",
  };
}

function defaultSelection(services: ServiceOption[]) {
  const first = services[0];
  if (!first) {
    return { serviceIds: [] as string[], variantIdsByService: {} as Record<string, string[]> };
  }
  if (serviceHasVariants(first)) {
    const firstVariantId = first.variants![0]?.id;
    return {
      serviceIds: firstVariantId ? [first.id] : [],
      variantIdsByService: firstVariantId ? { [first.id]: [firstVariantId] } : {},
    };
  }
  return { serviceIds: [first.id], variantIdsByService: {} as Record<string, string[]> };
}

function buildBookingItems(
  serviceIds: string[],
  variantIdsByService: Record<string, string[]>,
  services: ServiceOption[],
) {
  return serviceIds.map((serviceId) => {
    const svc = services.find((s) => s.id === serviceId);
    return {
      serviceId,
      variantIds: svc && serviceHasVariants(svc) ? variantIdsByService[serviceId] || [] : [],
    };
  });
}

function selectionComplete(
  serviceIds: string[],
  variantIdsByService: Record<string, string[]>,
  services: ServiceOption[],
) {
  if (!serviceIds.length) return false;
  return serviceIds.every((id) => {
    const svc = services.find((s) => s.id === id);
    if (!svc || !serviceHasVariants(svc)) return true;
    return (variantIdsByService[id] || []).length > 0;
  });
}

export function AdminCalendar({
  initialServices,
  timezone = "America/Toronto",
  weekStartsOn = 0,
}: {
  initialServices: ServiceOption[];
  timezone?: string;
  weekStartsOn?: 0 | 1;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => {
    const today = zonedParts(new Date(), timezone);
    return new Date(today.year, today.month - 1, today.day);
  });
  const [listRange, setListRange] = useState<ListRange>("upcoming");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");
  const [listSort, setListSort] = useState<"asc" | "desc">("asc");
  const [listTimeOfDay, setListTimeOfDay] = useState<TimeOfDay>("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<BlockedTimeItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [studioWeeklyHours, setStudioWeeklyHours] = useState<WeeklyHours>({});
  const [hstRateBps, setHstRateBps] = useState(1300);
  const [canWrite, setCanWrite] = useState(false);
  const [canManageAll, setCanManageAll] = useState(false);
  const [staffFilter, setStaffFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  /** When creating: the appointment whose party the new person joins. */
  const [groupAnchor, setGroupAnchor] = useState<Appointment | null>(null);
  const [groupMembers, setGroupMembers] = useState<Appointment[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [createStartsAt, setCreateStartsAt] = useState("");
  const [form, setForm] = useState({
    ...emptyFormFields(),
  });
  const [recurrence, setRecurrence] = useState({
    frequency: "none" as "none" | "weekly" | "biweekly",
    count: 4,
    until: "",
    endMode: "count" as "count" | "until",
  });
  const [clientQuery, setClientQuery] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<ClientOption[]>([]);
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    if (view === "month") {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      return {
        from: studioDayBounds(startOfWeek(monthStart, { weekStartsOn }), timezone).start,
        to: studioDayBounds(endOfWeek(monthEnd, { weekStartsOn }), timezone).end,
      };
    }
    if (view === "week") {
      return {
        from: studioDayBounds(startOfWeek(cursor, { weekStartsOn }), timezone).start,
        to: studioDayBounds(endOfWeek(cursor, { weekStartsOn }), timezone).end,
      };
    }
    if (view === "day") {
      const bounds = studioDayBounds(startOfDay(cursor), timezone);
      return { from: bounds.start, to: bounds.end };
    }
    return listRangeBounds(listRange, listFrom, listTo, timezone);
  }, [cursor, view, weekStartsOn, listRange, listFrom, listTo, timezone]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor, weekStartsOn]);

  const load = useCallback(() => {
    startTransition(async () => {
      setError("");
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      if (staffFilter) params.set("staffId", staffFilter);
      if (serviceFilter) params.set("serviceId", serviceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (view === "list") params.set("order", listSort);

      const res = await fetch(`/api/admin/appointments?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load appointments");
        return;
      }
      setAppointments(data.appointments || []);
      setStaff(
        (data.staff || []).map((s: StaffOption) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          role: s.role,
          serviceIds: s.serviceIds || [],
          weeklyHours: s.weeklyHours ?? null,
        })),
      );
      if (data.studioWeeklyHours) setStudioWeeklyHours(data.studioWeeklyHours);
      if (typeof data.hstRateBps === "number") setHstRateBps(data.hstRateBps);
      setCanWrite(Boolean(data.canWrite));
      setCanManageAll(Boolean(data.canManageAll));
    });
  }, [range.from, range.to, staffFilter, serviceFilter, statusFilter, view, listSort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!clientQuery.trim() || clientQuery.trim().length < 2) {
      setClientSuggestions([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/admin/clients?q=${encodeURIComponent(clientQuery.trim())}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setClientSuggestions(
        (data.clients || []).map((c: ClientOption) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone || null,
        })),
      );
    }, 220);
    return () => window.clearTimeout(t);
  }, [clientQuery]);

  useEffect(() => {
    const clientId = searchParams.get("clientId");
    if (!clientId || !canWrite) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/clients?id=${encodeURIComponent(clientId)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok || !data.client) return;
      const c = data.client;
      const starts = toStudioInputValue(new Date(), timezone);
      const selection = defaultSelection(initialServices);
      const assigned = staff.filter((s) =>
        selection.serviceIds.length
          ? selection.serviceIds.every((id) => s.serviceIds.includes(id))
          : false,
      );
      const hasAssignees = assigned.length > 0;
      setCreateStartsAt(starts);
      setForm({
        ...emptyFormFields(),
        ...selection,
        staffId: hasAssignees ? assigned[0]?.id || "" : "",
        clientId: c.id,
        clientName: c.name,
        clientEmail: c.email,
        clientPhone: c.phone || "",
        startsAt: starts,
      });
      setClientQuery(`${c.name} · ${c.email}`);
      setClientSuggestions([]);
      setRecurrence({ frequency: "none", count: 4, until: "", endMode: "count" });
      setSelected(null);
      setDrawer("create");
      router.replace("/admin/appointments", { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, canWrite, initialServices, router, staff]);

  function navigate(dir: -1 | 1) {
    if (view === "month") setCursor((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    else if (view === "week") setCursor((d) => (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
    else setCursor((d) => addDays(d, dir));
  }

  function selectClient(c: ClientOption) {
    setForm((f) => ({
      ...f,
      clientId: c.id,
      clientName: c.name,
      clientEmail: c.email,
      clientPhone: c.phone || "",
    }));
    setClientQuery(`${c.name} · ${c.email}`);
    setClientSuggestions([]);
  }

  function staffForServices(serviceIds: string[], keepStaffId?: string | null) {
    if (!serviceIds.length) return staff;
    const assigned = staff.filter((s) => serviceIds.every((id) => s.serviceIds.includes(id)));
    if (!assigned.length) return staff;
    if (keepStaffId && !assigned.some((s) => s.id === keepStaffId)) {
      const keep = staff.find((s) => s.id === keepStaffId);
      return keep ? [...assigned, keep] : assigned;
    }
    return assigned;
  }

  const serviceHasAssignees = useMemo(() => {
    if (!form.serviceIds.length) return false;
    return staff.some((s) => form.serviceIds.every((id) => s.serviceIds.includes(id)));
  }, [staff, form.serviceIds]);

  const formStaffOptions = useMemo(
    () => staffForServices(form.serviceIds, form.staffId || selected?.staffId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, form.serviceIds, form.staffId, selected?.staffId],
  );

  const hoursForGrid = useMemo(() => {
    if (staffFilter) {
      const member = staff.find((s) => s.id === staffFilter);
      return [effectiveWeeklyHours(member?.weeklyHours, studioWeeklyHours)];
    }
    if (staff.length) {
      return staff.map((s) => effectiveWeeklyHours(s.weeklyHours, studioWeeklyHours));
    }
    return [studioWeeklyHours];
  }, [staff, staffFilter, studioWeeklyHours]);

  const { hourStart, hourEnd } = useMemo(() => gridHourBounds(hoursForGrid), [hoursForGrid]);
  const hours = useMemo(
    () => Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i),
    [hourStart, hourEnd],
  );

  function toggleService(serviceId: string) {
    setForm((f) => {
      const removing = f.serviceIds.includes(serviceId);
      const nextIds = removing
        ? f.serviceIds.filter((id) => id !== serviceId)
        : [...f.serviceIds, serviceId];
      const nextVariants = { ...f.variantIdsByService };
      if (removing) {
        delete nextVariants[serviceId];
      } else {
        const svc = initialServices.find((s) => s.id === serviceId);
        if (svc && serviceHasVariants(svc)) {
          // Require explicit variant picks; leave empty until chosen.
          nextVariants[serviceId] = nextVariants[serviceId] || [];
        }
      }
      const allowed = staffForServices(nextIds, f.staffId);
      const staffStillOk = !f.staffId || allowed.some((s) => s.id === f.staffId);
      const hasAssignees = staff.some((s) => nextIds.every((id) => s.serviceIds.includes(id)));
      return {
        ...f,
        serviceIds: nextIds,
        variantIdsByService: nextVariants,
        staffId: staffStillOk
          ? f.staffId
          : hasAssignees
            ? allowed[0]?.id || ""
            : "",
      };
    });
  }

  function toggleVariant(serviceId: string, variantId: string) {
    setForm((f) => {
      const current = f.variantIdsByService[serviceId] || [];
      const nextVariantsForService = current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId];
      const nextVariants = { ...f.variantIdsByService };
      let nextIds = f.serviceIds;

      if (!nextVariantsForService.length) {
        delete nextVariants[serviceId];
        nextIds = f.serviceIds.filter((id) => id !== serviceId);
      } else {
        nextVariants[serviceId] = nextVariantsForService;
        if (!f.serviceIds.includes(serviceId)) {
          nextIds = [...f.serviceIds, serviceId];
        }
      }

      const allowed = staffForServices(nextIds, f.staffId);
      const staffStillOk = !f.staffId || allowed.some((s) => s.id === f.staffId);
      const hasAssignees = staff.some((s) =>
        nextIds.length ? nextIds.every((id) => s.serviceIds.includes(id)) : false,
      );
      return {
        ...f,
        serviceIds: nextIds,
        variantIdsByService: nextVariants,
        staffId: staffStillOk
          ? f.staffId
          : hasAssignees
            ? allowed[0]?.id || ""
            : "",
      };
    });
  }

  function openCreate(at: Date) {
    if (!canWrite) return;
    const starts = toStudioInputValue(at, timezone);
    const selection = defaultSelection(initialServices);
    const assigned = staffForServices(selection.serviceIds);
    const hasAssignees = staff.some((s) =>
      selection.serviceIds.length
        ? selection.serviceIds.every((id) => s.serviceIds.includes(id))
        : false,
    );
    setCreateStartsAt(starts);
    setForm({
      ...emptyFormFields(),
      ...selection,
      staffId: hasAssignees ? assigned[0]?.id || "" : "",
      startsAt: starts,
    });
    setClientQuery("");
    setClientSuggestions([]);
    setRecurrence({ frequency: "none", count: 4, until: "", endMode: "count" });
    setSelected(null);
    setGroupAnchor(null);
    setGroupMembers([]);
    setDrawer("create");
  }

  async function loadGroupMembers(groupId: string) {
    setLoadingGroup(true);
    try {
      const params = new URLSearchParams({ groupId, status: "all" });
      const res = await fetch(`/api/admin/appointments?${params}`);
      const data = await res.json().catch(() => ({}));
      const members: Appointment[] = res.ok ? data.appointments || [] : [];
      setGroupMembers(members);
      return members;
    } finally {
      setLoadingGroup(false);
    }
  }

  /** Open the create form pre-filled to add another person to `anchor`'s booking. */
  function openAddToGroup(anchor: Appointment) {
    if (!canWrite) return;
    const party = groupMembers.length ? groupMembers : [anchor];
    const lastEnd = party.filter((m) => m.status !== "cancelled").reduce(
      (latest, m) => (new Date(m.endsAt) > latest ? new Date(m.endsAt) : latest),
      new Date(anchor.endsAt),
    );
    const serviceIds = anchor.serviceIds?.length ? anchor.serviceIds : anchor.serviceId ? [anchor.serviceId] : [];
    const variantIdsByService: Record<string, string[]> = {};
    for (const item of anchor.items || []) {
      if (item.variantIds?.length) variantIdsByService[item.serviceId] = [...item.variantIds];
    }
    const starts = toStudioInputValue(lastEnd, timezone);
    setCreateStartsAt(starts);
    setForm({
      ...emptyFormFields(),
      serviceIds,
      variantIdsByService,
      staffId: anchor.staffId || "",
      startsAt: starts,
    });
    setClientQuery("");
    setClientSuggestions([]);
    setRecurrence({ frequency: "none", count: 4, until: "", endMode: "count" });
    setGroupAnchor(anchor);
    setGroupMembers(party);
    setSelected(null);
    setDrawer("create");
  }

  function openEdit(appt: Appointment) {
    setSelected(appt);
    setGroupAnchor(null);
    setGroupMembers([]);
    if (appt.groupId) void loadGroupMembers(appt.groupId);
    const serviceIds = appt.serviceIds?.length
      ? appt.serviceIds
      : appt.serviceId
        ? [appt.serviceId]
        : [];
    const variantIdsByService: Record<string, string[]> = {};
    if (appt.items?.length) {
      for (const item of appt.items) {
        if (item.variantIds?.length) variantIdsByService[item.serviceId] = [...item.variantIds];
      }
    }
    setForm({
      ...emptyFormFields(),
      serviceIds,
      variantIdsByService,
      staffId: appt.staffId || "",
      clientId: appt.clientId || "",
      clientName: appt.clientName,
      clientEmail: appt.clientEmail,
      clientPhone: appt.clientPhone || "",
      notes: appt.notes || "",
      startsAt: toStudioInputValue(new Date(appt.startsAt), timezone),
      paymentMode: appt.paymentMode || "deposit",
      priceDollars: moneyInputFromCents(appt.priceCents),
      depositDollars: moneyInputFromCents(appt.depositCents),
      amountPaidDollars: moneyInputFromCents(appt.amountChargedCents),
      discountDollars: moneyInputFromCents(appt.discountCents),
    });
    setClientQuery(appt.clientId ? `${appt.clientName} · ${appt.clientEmail}` : "");
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer(null);
    setSelected(null);
    setGroupAnchor(null);
    setGroupMembers([]);
    setClientSuggestions([]);
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (!selectionComplete(form.serviceIds, form.variantIdsByService, initialServices)) {
      setError("Select at least one service (and a variant when the service has options)");
      return;
    }
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = {
      items: buildBookingItems(form.serviceIds, form.variantIdsByService, initialServices),
      staffId: form.staffId || null,
      clientId: form.clientId || null,
      startsAt: zonedInputToUtc(form.startsAt || createStartsAt, timezone).toISOString(),
      clientName: form.clientName,
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone || null,
      notes: form.notes || "",
      status: "confirmed",
    };
    if (groupAnchor) {
      body.groupWithId = groupAnchor.id;
    } else if (recurrence.frequency !== "none") {
      body.recurrence = {
        frequency: recurrence.frequency,
        count: recurrence.endMode === "count" ? recurrence.count : undefined,
        until:
          recurrence.endMode === "until" && recurrence.until
            ? new Date(
                zonedInputToUtc(`${recurrence.until}T23:59`, timezone).getTime() + 59_999,
              ).toISOString()
            : null,
      };
    }
    const res = await fetch("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create appointment");
      return;
    }
    if (data.skipped?.length) {
      setError(
        `Created ${data.created}; skipped ${data.skipped.length} conflicting time(s).`,
      );
    }
    if (groupAnchor && data.groupId) {
      // Return to the party so the next person can be added straight away.
      const anchor = { ...groupAnchor, groupId: data.groupId as string };
      load();
      openEdit(anchor);
      return;
    }
    closeDrawer();
    load();
  }

  async function removeFromGroup() {
    if (!selected?.groupId) return;
    if (!window.confirm(`Remove ${selected.clientName} from this group booking? Their appointment stays booked.`)) {
      return;
    }
    await patchAppointment({ groupId: null }, { skipAnnounce: true });
  }

  async function patchAppointment(
    body: Record<string, unknown>,
    opts?: { skipAnnounce?: boolean; promptNotify?: boolean },
  ) {
    if (!canWrite || !selected) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        skipAnnounce: opts?.skipAnnounce || undefined,
        ...body,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not update appointment");
      return;
    }

    const changes: string[] = Array.isArray(data.changes) ? data.changes : [];
    if (opts?.promptNotify && changes.length) {
      const summary = changes.map((c) => `• ${c}`).join("\n");
      const notify = window.confirm(
        `Booking saved.\n\nAlert ${selected.clientName} (${selected.clientEmail}) about these updates?\n\n${summary}`,
      );
      if (notify) {
        const notifyRes = await fetch("/api/admin/appointments/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id, changeLines: changes }),
        });
        if (!notifyRes.ok) {
          const notifyData = await notifyRes.json().catch(() => ({}));
          setError(notifyData.error || "Saved, but client alert failed");
          load();
          return;
        }
      }
    }

    closeDrawer();
    load();
  }

  async function collectBalance(method: "stripe" | "cash" | "etransfer" | "card") {
    if (!canWrite || !selected) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/appointments/collect-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, method }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not collect balance");
      return;
    }
    if (method === "stripe" && data.checkoutUrl) {
      await navigator.clipboard?.writeText(data.checkoutUrl).catch(() => undefined);
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      alert(`Stripe balance link ready (also copied):\n${data.checkoutUrl}`);
    } else {
      alert(`Recorded ${data.collectedLabel || "payment"}. Remaining: ${data.remainingLabel || "$0.00"}`);
    }
    closeDrawer();
    load();
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selectionComplete(form.serviceIds, form.variantIdsByService, initialServices)) {
      setError("Select at least one service (and a variant when the service has options)");
      return;
    }
    const priceCents = parseMoneyInput(form.priceDollars);
    const amountChargedCents = parseMoneyInput(form.amountPaidDollars);
    const discountCents = parseMoneyInput(form.discountDollars);
    const depositCents = form.depositDollars.trim() === "" ? null : parseMoneyInput(form.depositDollars);
    if (priceCents == null || amountChargedCents == null || discountCents == null) {
      setError("Enter valid payment amounts (dollars)");
      return;
    }
    if (form.depositDollars.trim() !== "" && depositCents == null) {
      setError("Enter a valid deposit amount (dollars)");
      return;
    }
    await patchAppointment(
      {
        notes: form.notes,
        staffId: canManageAll ? form.staffId || null : undefined,
        startsAt: form.startsAt ? zonedInputToUtc(form.startsAt, timezone).toISOString() : undefined,
        clientId: form.clientId || null,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone || null,
        items: buildBookingItems(form.serviceIds, form.variantIdsByService, initialServices),
        paymentMode: form.paymentMode,
        priceCents,
        depositCents,
        amountChargedCents,
        discountCents,
      },
      { skipAnnounce: true, promptNotify: true },
    );
  }

  const editPaymentPreview = useMemo(() => {
    if (drawer !== "edit" || !selected) return null;
    const priceCents = parseMoneyInput(form.priceDollars) ?? 0;
    const amountChargedCents = parseMoneyInput(form.amountPaidDollars) ?? 0;
    const discountCents = parseMoneyInput(form.discountDollars) ?? 0;
    const balanceDueCents = estimateBalanceDueCents(
      {
        status: selected.status,
        paymentMode: form.paymentMode,
        priceCents,
        amountChargedCents,
        discountCents,
      },
      hstRateBps,
    );
    return {
      priceLabel: formatCad(priceCents),
      paidLabel: formatCad(amountChargedCents),
      balanceDueCents,
      balanceDueLabel: balanceDueCents > 0 ? formatCad(balanceDueCents) : null,
    };
  }, [
    drawer,
    selected,
    form.paymentMode,
    form.priceDollars,
    form.amountPaidDollars,
    form.discountDollars,
    hstRateBps,
  ]);

  function appointmentsForDay(day: Date) {
    const key = calendarKey(day);
    return appointments.filter((a) => zonedParts(new Date(a.startsAt), timezone).dateKey === key);
  }

  function blocksForDay(day: Date) {
    const bounds = studioDayBounds(day, timezone);
    const dayStart = bounds.start.getTime();
    const dayEnd = bounds.end.getTime();
    return blocks.filter((b) => {
      if (staffFilter && b.staffId && b.staffId !== staffFilter) return false;
      const start = new Date(b.startsAt).getTime();
      const end = new Date(b.endsAt).getTime();
      return start < dayEnd && end > dayStart;
    });
  }

  const visibleBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (staffFilter && b.staffId && b.staffId !== staffFilter) return false;
      const start = new Date(b.startsAt).getTime();
      const end = new Date(b.endsAt).getTime();
      return start < range.to.getTime() && end > range.from.getTime();
    });
  }, [blocks, staffFilter, range.from, range.to]);

  /** List view: appointments + blocks filtered by time of day, sorted, grouped by studio day. */
  const listGroups = useMemo(() => {
    if (view !== "list") return [];
    type Item =
      | { kind: "appt"; startsAt: string; appt: Appointment }
      | { kind: "block"; startsAt: string; block: BlockedTimeItem };
    const items: Item[] = [
      ...appointments
        .filter((a) => matchesTimeOfDay(a.startsAt, listTimeOfDay, timezone))
        .map((a) => ({ kind: "appt" as const, startsAt: a.startsAt, appt: a })),
      ...visibleBlocks
        .filter((b) => matchesTimeOfDay(b.startsAt, listTimeOfDay, timezone))
        .map((b) => ({ kind: "block" as const, startsAt: b.startsAt, block: b })),
    ];
    const dir = listSort === "asc" ? 1 : -1;
    items.sort((x, y) => dir * (new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime()));
    const groups: { key: string; label: string; items: Item[]; apptCount: number }[] = [];
    for (const item of items) {
      const key = zonedParts(new Date(item.startsAt), timezone).dateKey;
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = {
          key,
          label: new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(new Date(item.startsAt)),
          items: [],
          apptCount: 0,
        };
        groups.push(group);
      }
      group.items.push(item);
      if (item.kind === "appt") group.apptCount += 1;
    }
    return groups;
  }, [view, appointments, visibleBlocks, listTimeOfDay, listSort, timezone]);

  const listApptCount = listGroups.reduce((sum, g) => sum + g.apptCount, 0);

  const monthCells = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor, weekStartsOn]);

  const dayHeaders = weekStartsOn === 1 ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const titleLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
        : view === "day"
          ? format(cursor, "EEEE, MMMM d, yyyy")
          : listRange === "custom"
            ? `${new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "short", day: "numeric" }).format(range.from)} – ${new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "short", day: "numeric", year: "numeric" }).format(range.to)}`
            : LIST_RANGE_OPTIONS.find((o) => o.id === listRange)?.label || "List";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["month", "week", "day", "list"] as ViewMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                view === key ? "admin-chip-active" : "bg-white/10 text-white/70"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view !== "list" ? (
            <>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70"
                onClick={() => navigate(-1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70"
                onClick={() => setCursor(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70"
                onClick={() => navigate(1)}
              >
                Next
              </button>
            </>
          ) : null}
          <p className="min-w-[10rem] text-sm font-medium text-[#f5f1eb]">{titleLabel}</p>
          {canWrite ? (
            <button type="button" className="admin-btn !py-2" onClick={() => openCreate(new Date())}>
              New
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {canManageAll ? (
          <label className="grid gap-1 text-xs text-white/50">
            Staff
            <select
              className="admin-input !py-2 text-sm"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1 text-xs text-white/50">
          Service
          <select
            className="admin-input !py-2 text-sm"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="">All services</option>
            {initialServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Status
          <select
            className="admin-input !py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {view === "list" ? (
          <>
            <label className="grid gap-1 text-xs text-white/50">
              Dates
              <select
                className="admin-input !py-2 text-sm"
                value={listRange}
                onChange={(e) => {
                  const next = e.target.value as ListRange;
                  setListRange(next);
                  setListSort(next === "past7" || next === "past30" ? "desc" : "asc");
                  if (next === "custom" && !listFrom) {
                    const today = zonedParts(new Date(), timezone).dateKey;
                    setListFrom(today);
                    setListTo(shiftDateKey(today, 7));
                  }
                }}
              >
                {LIST_RANGE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {listRange === "custom" ? (
              <>
                <label className="grid gap-1 text-xs text-white/50">
                  From
                  <input
                    type="date"
                    className="admin-input !py-2 text-sm"
                    value={listFrom}
                    onChange={(e) => setListFrom(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs text-white/50">
                  To
                  <input
                    type="date"
                    className="admin-input !py-2 text-sm"
                    value={listTo}
                    min={listFrom || undefined}
                    onChange={(e) => setListTo(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-1 text-xs text-white/50">
              Time of day
              <select
                className="admin-input !py-2 text-sm"
                value={listTimeOfDay}
                onChange={(e) => setListTimeOfDay(e.target.value as TimeOfDay)}
              >
                {TIME_OF_DAY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-white/50">
              Sort
              <select
                className="admin-input !py-2 text-sm"
                value={listSort}
                onChange={(e) => setListSort(e.target.value as "asc" | "desc")}
              >
                <option value="asc">Earliest first</option>
                <option value="desc">Latest first</option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {pending && !appointments.length ? <p className="text-sm text-white/50">Loading…</p> : null}

      {view === "month" ? (
        <div className="admin-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/10 text-center text-[0.65rem] uppercase tracking-[0.12em] text-white/45">
            {dayHeaders.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day) => {
              const dayAppts = appointmentsForDay(day);
              const dayBlocks = blocksForDay(day);
              const inMonth = isSameMonth(day, cursor);
              const isToday = calendarKey(day) === zonedParts(new Date(), timezone).dateKey;
              const apptSlots = Math.max(1, 3 - Math.min(2, dayBlocks.length));
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[6.5rem] border-b border-r border-white/5 p-2 text-left ${
                    inMonth ? "" : "opacity-40"
                  }`}
                >
                  <button
                    type="button"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition hover:bg-white/10 ${
                      isToday ? "bg-[#c6a75e] text-[#0f0f0f]" : "text-white/70"
                    }`}
                    onClick={() => {
                      setCursor(day);
                      setView("day");
                    }}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="mt-1 space-y-0.5">
                    {dayBlocks.slice(0, 2).map((b) => (
                      <div
                        key={b.id}
                        className="block w-full truncate rounded px-1 py-0.5 text-left text-[0.62rem] text-white/80"
                        style={{ background: "rgba(120,120,120,0.55)" }}
                        title={b.reason || "Blocked"}
                      >
                        Blocked{b.reason ? ` · ${b.reason}` : ""}
                      </div>
                    ))}
                    {dayAppts.slice(0, apptSlots).map((a) => {
                      const unpaid = a.status === "pending_payment";
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[0.62rem] ${
                            unpaid ? "border border-dashed border-white/40 text-white/80" : "text-[#0f0f0f]"
                          }`}
                          style={{
                            background: unpaid ? "rgba(255,255,255,0.12)" : a.staffColor || "#c6a75e",
                          }}
                          onClick={() => openEdit(a)}
                        >
                          {formatTime(a.startsAt, timezone)} {unpaid ? "(unpaid) " : ""}
                          {a.clientName}
                          {(a.groupSize || 1) > 1 ? ` · group of ${a.groupSize}` : ""}
                        </button>
                      );
                    })}
                    {dayAppts.length + dayBlocks.length > 3 ? (
                      <p className="text-[0.6rem] text-white/40">
                        +{dayAppts.length + dayBlocks.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <TimelineGrid
          days={weekDays}
          hours={hours}
          hourStart={hourStart}
          hourEnd={hourEnd}
          appointments={appointments}
          blocks={visibleBlocks}
          closedHoursForDay={(day) => {
            const key = dayKeyFromWeekday(day.getDay());
            const weekly = staffFilter
              ? effectiveWeeklyHours(
                  staff.find((s) => s.id === staffFilter)?.weeklyHours,
                  studioWeeklyHours,
                )
              : studioWeeklyHours;
            return closedRangesForDay(weekly, key, hourStart * 60, hourEnd * 60);
          }}
          timezone={timezone}
          canWrite={canWrite}
          onSlotClick={openCreate}
          onEventClick={openEdit}
        />
      ) : null}

      {view === "day" ? (
        <TimelineGrid
          days={[startOfDay(cursor)]}
          hours={hours}
          hourStart={hourStart}
          hourEnd={hourEnd}
          appointments={appointments}
          blocks={visibleBlocks}
          closedHoursForDay={(day) => {
            const key = dayKeyFromWeekday(day.getDay());
            const weekly = staffFilter
              ? effectiveWeeklyHours(
                  staff.find((s) => s.id === staffFilter)?.weeklyHours,
                  studioWeeklyHours,
                )
              : studioWeeklyHours;
            return closedRangesForDay(weekly, key, hourStart * 60, hourEnd * 60);
          }}
          timezone={timezone}
          canWrite={canWrite}
          onSlotClick={openCreate}
          onEventClick={openEdit}
          single
        />
      ) : null}

      {view === "list" ? (
        <div className="space-y-6">
          {!pending || listGroups.length ? (
            <p className="text-xs uppercase tracking-[0.14em] text-white/40">
              {listApptCount} appointment{listApptCount === 1 ? "" : "s"}
              {appointments.length >= 500 ? " · showing first 500, narrow the dates to see more" : ""}
            </p>
          ) : null}
          {listGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h3 className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2 text-sm font-semibold text-[#f5f1eb]">
                <span>{group.label}</span>
                <span className="text-xs font-normal text-white/40">
                  {group.apptCount} appointment{group.apptCount === 1 ? "" : "s"}
                </span>
              </h3>
              {group.items.map((item) =>
                item.kind === "block" ? (
                  <article
                    key={`block-${item.block.id}`}
                    className="admin-card border border-white/10 bg-white/[0.03] p-5"
                  >
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/40">Blocked</p>
                    <p className="mt-1 text-sm font-semibold text-white/85">
                      {item.block.reason || "Unavailable"}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {formatTime(item.block.startsAt, timezone)} → {formatTime(item.block.endsAt, timezone)}
                      {item.block.staffName ? ` · ${item.block.staffName}` : " · Studio-wide"}
                    </p>
                  </article>
                ) : (
                  <article
                    key={item.appt.id}
                    className="admin-card cursor-pointer p-5 transition hover:bg-white/[0.06]"
                    onClick={() => openEdit(item.appt)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-4">
                        <div className="w-20 shrink-0">
                          <p className="text-base font-semibold text-white">
                            {formatTime(item.appt.startsAt, timezone)}
                          </p>
                          <p className="text-xs text-white/40">to {formatTime(item.appt.endsAt, timezone)}</p>
                        </div>
                        <span
                          className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                          style={{ background: item.appt.staffColor || "#c6a75e" }}
                          aria-hidden
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{item.appt.serviceTitle}</p>
                          <p className="mt-1 text-sm text-white/80">
                            {item.appt.clientName}
                            {(item.appt.groupSize || 1) > 1 ? (
                              <span className="ml-2 rounded-full border border-[#c6a75e]/50 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                                Group of {item.appt.groupSize}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-white/50">
                            <a
                              href={`mailto:${item.appt.clientEmail}`}
                              className="underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.appt.clientEmail}
                            </a>
                            {item.appt.clientPhone ? ` · ${item.appt.clientPhone}` : ""}
                            {item.appt.staffName ? ` · ${item.appt.staffName}` : ""}
                          </p>
                          {item.appt.notes ? (
                            <p className="mt-2 text-sm text-white/45">{item.appt.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.12em] text-white/45">
                        <p>{item.appt.status.replace("_", " ")}</p>
                        <p className="mt-1 normal-case tracking-normal text-white/70">
                          Charged {item.appt.amountLabel}
                          <span className="text-white/40"> · service {item.appt.priceLabel}</span>
                        </p>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </section>
          ))}
          {!listGroups.length && !pending ? (
            <p className="text-sm text-white/50">No appointments match these filters.</p>
          ) : null}
        </div>
      ) : null}

      <BlockedTimesPanel
        canWrite={canWrite}
        canManageAll={canManageAll}
        staff={staff}
        timezone={timezone}
        onChanged={(next) => setBlocks(next)}
      />
      <DayOverridesPanel canWrite={canWrite} canManageAll={canManageAll} staff={staff} />

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={closeDrawer}>
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#141414] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">
                {drawer === "create"
                  ? groupAnchor
                    ? "Add person to booking"
                    : "New appointment"
                  : "Edit appointment"}
              </h2>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-white/50 hover:text-white"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {drawer === "edit" && selected ? (
                <div className="mb-4 space-y-1 text-sm text-white/60">
                  <p className="font-medium text-white">{selected.serviceTitle}</p>
                  <p>{formatWhen(selected.startsAt, timezone)}</p>
                  <p className="uppercase tracking-[0.12em] text-[0.65rem] text-[#c6a75e]">
                    {selected.status.replace("_", " ")}
                  </p>
                  <p className="text-xs text-white/50">
                    Paid {editPaymentPreview?.paidLabel || selected.amountLabel} · service{" "}
                    {editPaymentPreview?.priceLabel || selected.priceLabel}
                    {(editPaymentPreview?.balanceDueLabel || selected.balanceDueLabel) ? (
                      <span className="text-[#c6a75e]">
                        {" "}
                        · balance due {editPaymentPreview?.balanceDueLabel || selected.balanceDueLabel}
                      </span>
                    ) : null}
                  </p>
                  {selected.seriesId ? (
                    <p className="text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                      Part of a recurring series
                    </p>
                  ) : null}
                  <a href={`mailto:${selected.clientEmail}`} className="inline-block text-[#c6a75e] underline">
                    Email {selected.clientName}
                  </a>
                </div>
              ) : null}

              {drawer === "edit" && selected ? (
                <div className="mb-4 rounded-lg border border-white/10 p-3 text-sm">
                  {selected.groupId ? (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e]">
                          Group booking · {groupMembers.length || selected.groupSize || 1} people
                        </p>
                        {loadingGroup ? <span className="text-xs text-white/40">Loading…</span> : null}
                      </div>
                      <ul className="space-y-1.5">
                        {groupMembers.map((m) => {
                          const isCurrent = m.id === selected.id;
                          return (
                            <li key={m.id}>
                              <button
                                type="button"
                                disabled={isCurrent}
                                onClick={() => openEdit(m)}
                                className={`w-full rounded-md border px-2.5 py-1.5 text-left ${
                                  isCurrent
                                    ? "border-[#c6a75e]/50 bg-[#c6a75e]/10"
                                    : "border-white/10 hover:border-white/30"
                                }`}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-white">
                                    {m.clientName}
                                    {isCurrent ? <span className="text-white/40"> (viewing)</span> : null}
                                  </span>
                                  <span className="text-xs text-white/50">{m.priceLabel}</span>
                                </span>
                                <span className="block text-xs text-white/50">
                                  {formatWhen(m.startsAt, timezone)} · {m.serviceLabel || m.serviceTitle}
                                  {m.staffName ? ` · ${m.staffName}` : ""}
                                  {m.status !== "confirmed" ? ` · ${m.status.replace("_", " ")}` : ""}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {groupMembers.length > 1 ? (
                        <p className="mt-2 text-xs text-white/50">
                          Group total{" "}
                          {formatCad(
                            groupMembers
                              .filter((m) => m.status !== "cancelled")
                              .reduce((sum, m) => sum + (m.priceCents || 0), 0),
                          )}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mb-2 text-xs text-white/50">
                      Booking for more than one person? Add each extra guest with their own services and time.
                    </p>
                  )}
                  {canWrite ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.status !== "cancelled" && selected.status !== "expired" ? (
                        <button
                          type="button"
                          onClick={() => openAddToGroup(selected)}
                          className="rounded-full border border-[#c6a75e]/60 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-[#c6a75e] hover:bg-[#c6a75e]/10"
                        >
                          + Add person to this booking
                        </button>
                      ) : null}
                      {selected.groupId ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={removeFromGroup}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-white/60 hover:text-white"
                        >
                          Remove from group
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {drawer === "create" && groupAnchor ? (
                <div className="mb-4 rounded-lg border border-[#c6a75e]/40 bg-[#c6a75e]/5 p-3 text-sm text-white/70">
                  <p>
                    Joining <span className="font-medium text-white">{groupAnchor.clientName}</span>&apos;s booking
                    · {formatWhen(groupAnchor.startsAt, timezone)}
                  </p>
                  {groupMembers.length > 1 ? (
                    <p className="mt-1 text-xs text-white/50">
                      Already in this group: {groupMembers.map((m) => m.clientName).join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const v = toStudioInputValue(new Date(groupAnchor.startsAt), timezone);
                        setForm((f) => ({ ...f, startsAt: v }));
                        setCreateStartsAt(v);
                      }}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      Same time as {groupAnchor.clientName.split(" ")[0]}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const lastEnd = (groupMembers.length ? groupMembers : [groupAnchor])
                          .filter((m) => m.status !== "cancelled")
                          .reduce(
                            (latest, m) => (new Date(m.endsAt) > latest ? new Date(m.endsAt) : latest),
                            new Date(groupAnchor.endsAt),
                          );
                        const v = toStudioInputValue(lastEnd, timezone);
                        setForm((f) => ({ ...f, startsAt: v }));
                        setCreateStartsAt(v);
                      }}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      Right after the last person
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Same time needs a different staff member — one person can&apos;t be double-booked.
                  </p>
                </div>
              ) : null}

              {(drawer === "create" || (drawer === "edit" && canWrite)) && (
                <form
                  onSubmit={drawer === "create" ? submitCreate : saveEdit}
                  className="grid gap-3"
                >
                  {(drawer === "create" || drawer === "edit") ? (
                    <fieldset className="grid gap-2 text-sm text-white/70">
                      <legend className="mb-1">Services</legend>
                      <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-white/10 p-3">
                        {initialServices.map((s) => {
                          const hasVariants = serviceHasVariants(s);
                          const checked = form.serviceIds.includes(s.id);
                          const chosenVariants = form.variantIdsByService[s.id] || [];
                          if (hasVariants) {
                            return (
                              <div key={s.id} className="space-y-1.5">
                                <div>
                                  <p className="text-sm text-white/80">{s.title}</p>
                                  {s.categoryTitle ? (
                                    <p className="text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                                      {s.categoryTitle}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="ml-1 space-y-1 border-l border-white/10 pl-3">
                                  {(s.variants || []).map((v) => {
                                    const on = chosenVariants.includes(v.id);
                                    return (
                                      <label
                                        key={v.id}
                                        className="flex items-start gap-2 text-sm text-white/75"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-1"
                                          checked={on}
                                          onChange={() => toggleVariant(s.id, v.id)}
                                        />
                                        <span>
                                          {v.title}
                                          <span className="mt-0.5 block text-[0.65rem] text-white/40">
                                            {formatCad(v.priceCents)} · {v.durationMinutes} min
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                                {checked && !chosenVariants.length ? (
                                  <p className="text-xs text-amber-200/80">Select at least one option</p>
                                ) : null}
                              </div>
                            );
                          }
                          return (
                            <label key={s.id} className="flex items-start gap-2 text-sm text-white/80">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                onChange={() => toggleService(s.id)}
                              />
                              <span>
                                {s.title}
                                {s.categoryTitle ? (
                                  <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                                    {s.categoryTitle}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : null}

                  <label className="grid gap-1 text-sm text-white/70">
                    Starts
                    <input
                      type="datetime-local"
                      className="admin-input"
                      value={form.startsAt}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                      required={drawer === "create"}
                    />
                  </label>

                  {canManageAll ? (
                    <label className="grid gap-1 text-sm text-white/70">
                      Staff
                      <select
                        className="admin-input"
                        value={form.staffId}
                        onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                        required={drawer === "create" && serviceHasAssignees}
                      >
                        {!serviceHasAssignees ? (
                          <option value="">Unassigned</option>
                        ) : (
                          <option value="" disabled>
                            Select staff
                          </option>
                        )}
                        {formStaffOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {drawer === "create" ? (
                        <span className="text-xs text-white/40">
                          {serviceHasAssignees
                            ? "Only team members assigned to this service"
                            : "No assignees — studio-wide booking"}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {canManageAll ? (
                    <div className="relative grid gap-1 text-sm text-white/70">
                      <label htmlFor="client-search">Find client</label>
                      <input
                        id="client-search"
                        className="admin-input"
                        placeholder="Search name or email…"
                        value={clientQuery}
                        onChange={(e) => {
                          setClientQuery(e.target.value);
                          setForm((f) => ({ ...f, clientId: "" }));
                        }}
                        autoComplete="off"
                      />
                      {clientSuggestions.length > 0 ? (
                        <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/15 bg-[#1a1a1a] shadow-xl">
                          {clientSuggestions.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                                onClick={() => selectClient(c)}
                              >
                                <span className="font-medium text-white">{c.name}</span>
                                <span className="block text-xs text-white/45">{c.email}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="grid gap-1 text-sm text-white/70">
                    Client name
                    <input
                      className="admin-input"
                      value={form.clientName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, clientName: e.target.value, clientId: "" }))
                      }
                      required={drawer === "create"}
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-white/70">
                    Email
                    <input
                      type="email"
                      className="admin-input"
                      value={form.clientEmail}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, clientEmail: e.target.value, clientId: "" }))
                      }
                      required={drawer === "create"}
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-white/70">
                    Phone
                    <input
                      className="admin-input"
                      value={form.clientPhone}
                      onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-white/70">
                    Notes
                    <textarea
                      className="admin-input"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </label>

                  {drawer === "edit" ? (
                    <fieldset className="grid gap-3 rounded-lg border border-white/10 p-3">
                      <legend className="px-1 text-sm text-white/70">Payment</legend>
                      <label className="grid gap-1 text-sm text-white/70">
                        Payment mode
                        <select
                          className="admin-input"
                          value={form.paymentMode}
                          onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                        >
                          <option value="deposit">Deposit</option>
                          <option value="full">Full</option>
                          <option value="none">None (pay at studio)</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm text-white/70">
                        Service total (CAD)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="admin-input"
                          value={form.priceDollars}
                          onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
                          required
                        />
                      </label>
                      {form.paymentMode === "deposit" ? (
                        <label className="grid gap-1 text-sm text-white/70">
                          Deposit amount (CAD)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="admin-input"
                            value={form.depositDollars}
                            onChange={(e) => setForm((f) => ({ ...f, depositDollars: e.target.value }))}
                          />
                        </label>
                      ) : null}
                      <label className="grid gap-1 text-sm text-white/70">
                        Amount paid (CAD)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="admin-input"
                          value={form.amountPaidDollars}
                          onChange={(e) => setForm((f) => ({ ...f, amountPaidDollars: e.target.value }))}
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-sm text-white/70">
                        Discount (CAD)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="admin-input"
                          value={form.discountDollars}
                          onChange={(e) => setForm((f) => ({ ...f, discountDollars: e.target.value }))}
                        />
                      </label>
                      <p className="text-xs text-white/45">
                        Remaining balance:{" "}
                        <span className={editPaymentPreview?.balanceDueCents ? "text-[#c6a75e]" : "text-white/70"}>
                          {editPaymentPreview?.balanceDueLabel || formatCad(0)}
                        </span>
                        {form.paymentMode !== "deposit" && form.paymentMode !== "none" ? (
                          <span className="block mt-1 text-white/35">
                            Balance is tracked for deposit and pay-at-studio bookings.
                          </span>
                        ) : null}
                      </p>
                    </fieldset>
                  ) : null}

                  {drawer === "create" && !groupAnchor ? (
                    <details className="rounded-lg border border-white/10 p-3">
                      <summary className="cursor-pointer text-sm text-white/70">
                        Recurring series
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1 text-sm text-white/70">
                          Frequency
                          <select
                            className="admin-input"
                            value={recurrence.frequency}
                            onChange={(e) =>
                              setRecurrence((r) => ({
                                ...r,
                                frequency: e.target.value as "none" | "weekly" | "biweekly",
                              }))
                            }
                          >
                            <option value="none">Does not repeat</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Every 2 weeks</option>
                          </select>
                        </label>
                        {recurrence.frequency !== "none" ? (
                          <>
                            <label className="grid gap-1 text-sm text-white/70">
                              Ends
                              <select
                                className="admin-input"
                                value={recurrence.endMode}
                                onChange={(e) =>
                                  setRecurrence((r) => ({
                                    ...r,
                                    endMode: e.target.value as "count" | "until",
                                  }))
                                }
                              >
                                <option value="count">After N visits</option>
                                <option value="until">On date</option>
                              </select>
                            </label>
                            {recurrence.endMode === "count" ? (
                              <label className="grid gap-1 text-sm text-white/70">
                                Visits (2–26)
                                <input
                                  type="number"
                                  min={2}
                                  max={26}
                                  className="admin-input"
                                  value={recurrence.count}
                                  onChange={(e) =>
                                    setRecurrence((r) => ({
                                      ...r,
                                      count: Math.min(26, Math.max(2, Number(e.target.value) || 2)),
                                    }))
                                  }
                                />
                              </label>
                            ) : (
                              <label className="grid gap-1 text-sm text-white/70">
                                Until
                                <input
                                  type="date"
                                  className="admin-input"
                                  value={recurrence.until}
                                  onChange={(e) =>
                                    setRecurrence((r) => ({ ...r, until: e.target.value }))
                                  }
                                />
                              </label>
                            )}
                          </>
                        ) : null}
                      </div>
                    </details>
                  ) : null}

                  <button type="submit" className="admin-btn w-fit" disabled={saving}>
                    {saving
                      ? "Saving…"
                      : drawer === "create"
                        ? recurrence.frequency !== "none"
                          ? "Create series"
                          : "Create"
                        : "Save changes"}
                  </button>
                  {drawer === "edit" ? (
                    <p className="text-xs text-white/40">
                      After saving, you&apos;ll be asked whether to email/SMS the client with what changed.
                    </p>
                  ) : null}
                </form>
              )}

              {drawer === "edit" && selected && canWrite ? (
                <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                  {(selected.balanceDueCents || 0) > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/45">
                        Collect balance {selected.balanceDueLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-full border border-[#c6a75e]/50 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] transition hover:bg-[#c6a75e]/10"
                          onClick={() => void collectBalance("stripe")}
                        >
                          Stripe link
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                          onClick={() => void collectBalance("cash")}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                          onClick={() => void collectBalance("etransfer")}
                        >
                          E-transfer
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                          onClick={() => void collectBalance("card")}
                        >
                          Card at studio
                        </button>
                      </div>
                      <a
                        href="/admin/payments"
                        className="inline-block text-xs text-[#c6a75e] underline"
                      >
                        All pending payments
                      </a>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {STATUS_ACTIONS.filter((a) => {
                      if (a.status === selected.status) return false;
                      if (a.status === "confirmed") {
                        return selected.status === "pending_payment" || selected.status === "expired";
                      }
                      return true;
                    }).map((a) => (
                      <button
                        key={a.status}
                        type="button"
                        disabled={saving}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                        onClick={() => patchAppointment({ status: a.status })}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {drawer === "edit" && !canWrite ? (
                <p className="text-sm text-white/45">View only — you cannot edit this appointment.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clipBlockToDay(startsAt: string, endsAt: string, day: Date, timezone: string) {
  const bounds = studioDayBounds(day, timezone);
  const dayStart = bounds.start.getTime();
  const dayEnd = bounds.end.getTime() - 1;
  const start = Math.max(new Date(startsAt).getTime(), dayStart);
  const end = Math.min(new Date(endsAt).getTime(), dayEnd);
  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  };
}

function TimelineGrid({
  days,
  hours,
  hourStart,
  hourEnd,
  appointments,
  blocks,
  closedHoursForDay,
  timezone,
  canWrite,
  onSlotClick,
  onEventClick,
  single = false,
}: {
  days: Date[];
  hours: number[];
  hourStart: number;
  hourEnd: number;
  appointments: Appointment[];
  blocks: BlockedTimeItem[];
  closedHoursForDay: (day: Date) => { startMin: number; endMin: number }[];
  timezone: string;
  canWrite: boolean;
  onSlotClick: (at: Date) => void;
  onEventClick: (a: Appointment) => void;
  single?: boolean;
}) {
  const colTemplate = single ? "4.5rem 1fr" : `4.5rem repeat(${days.length}, minmax(0, 1fr))`;
  const dayMinutes = Math.max(60, (hourEnd - hourStart) * 60);
  const span = Math.max(1, hourEnd - hourStart);

  return (
    <div className="admin-card overflow-x-auto">
      <div className="min-w-[640px]" style={{ display: "grid", gridTemplateColumns: colTemplate }}>
        <div className="border-b border-white/10" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-b border-l border-white/10 px-2 py-2 text-center text-[0.65rem] uppercase tracking-[0.12em] text-white/50"
          >
            <span className="text-white/80">{format(day, single ? "EEEE" : "EEE")}</span>
            <span className="ml-1 text-[#c6a75e]">{format(day, "d")}</span>
          </div>
        ))}

        <div className="relative" style={{ height: `${hours.length * 3.25}rem` }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[0.65rem] text-white/35"
              style={{ top: `${((h - hourStart) / span) * 100}%` }}
            >
              {format(new Date(2000, 0, 1, h), "ha")}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayKey = calendarKey(day);
          const dayAppts = appointments.filter(
            (a) => zonedParts(new Date(a.startsAt), timezone).dateKey === dayKey,
          );
          const bounds = studioDayBounds(day, timezone);
          const dayStart = bounds.start.getTime();
          const dayEnd = bounds.end.getTime();
          const dayBlocks = blocks.filter((b) => {
            const start = new Date(b.startsAt).getTime();
            const end = new Date(b.endsAt).getTime();
            return start < dayEnd && end > dayStart;
          });
          const closed = closedHoursForDay(day);
          return (
            <div
              key={`col-${day.toISOString()}`}
              className="relative border-l border-white/10"
              style={{ height: `${hours.length * 3.25}rem` }}
            >
              {closed.map((c, i) => (
                <div
                  key={`closed-${i}`}
                  className="pointer-events-none absolute inset-x-0 z-[1] bg-black/35"
                  style={{
                    top: `${((c.startMin - hourStart * 60) / dayMinutes) * 100}%`,
                    height: `${((c.endMin - c.startMin) / dayMinutes) * 100}%`,
                  }}
                  title="Outside open hours"
                />
              ))}
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={!canWrite}
                  className="absolute inset-x-0 z-[2] border-t border-white/5 transition hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                  style={{
                    top: `${((h - hourStart) / span) * 100}%`,
                    height: `${(1 / span) * 100}%`,
                  }}
                  onClick={() => onSlotClick(studioAt(day, h, 0, timezone))}
                  aria-label={`Create at ${h}:00`}
                />
              ))}
              {dayBlocks.map((b) => {
                const clipped = clipBlockToDay(b.startsAt, b.endsAt, day, timezone);
                const style = eventStyle(
                  clipped.startsAt,
                  clipped.endsAt,
                  dayKey,
                  timezone,
                  hourStart,
                  dayMinutes,
                );
                return (
                  <div
                    key={b.id}
                    className="pointer-events-none absolute inset-x-1 z-[5] overflow-hidden rounded-md border border-white/15 bg-white/10 px-1.5 py-1 text-left text-[0.65rem] leading-tight text-white/70"
                    style={style}
                    title={b.reason || "Blocked"}
                  >
                    <span className="font-semibold">Blocked</span>
                    <span className="block truncate opacity-80">
                      {b.reason || b.staffName || "Studio"}
                    </span>
                  </div>
                );
              })}
              {dayAppts.map((a) => {
                const style = eventStyle(a.startsAt, a.endsAt, dayKey, timezone, hourStart, dayMinutes);
                const unpaid = a.status === "pending_payment";
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`absolute inset-x-1 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-[0.65rem] leading-tight shadow-sm transition hover:brightness-110 ${
                      unpaid ? "border border-dashed border-white/50 text-white/90" : "text-[#0f0f0f]"
                    }`}
                    style={{
                      ...style,
                      background: unpaid ? "rgba(255,255,255,0.12)" : a.staffColor || "#c6a75e",
                      opacity: unpaid ? 0.85 : 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(a);
                    }}
                  >
                    <span className="font-semibold">
                      {formatTime(a.startsAt, timezone)}
                      {unpaid ? " · unpaid" : ""}
                    </span>
                    <span className="block truncate">
                      {a.clientName}
                      {(a.groupSize || 1) > 1 ? ` · group of ${a.groupSize}` : ""}
                    </span>
                    <span className="block truncate opacity-80">{a.serviceTitle}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
