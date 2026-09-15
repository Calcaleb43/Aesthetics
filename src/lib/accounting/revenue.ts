import { addDays, endOfDay, format, startOfDay, startOfMonth, subDays } from "date-fns";
import type { Database } from "@/lib/db";
import { formatCad, zonedParts } from "@/lib/booking/money";
import { appointmentDisplayTitle } from "@/lib/booking/labels";

export type RevenueBasis = "cash" | "accrual";

export type RevenueRangePreset = "today" | "7d" | "30d" | "mtd" | "ytd" | "custom";

export type LedgerRow = {
  id: string;
  kind: "appointment" | "package" | "adjustment" | "expense";
  typeLabel: string;
  occurredAt: string;
  clientName: string;
  clientEmail: string;
  description: string;
  staffName: string | null;
  status: string;
  paymentMode: string | null;
  /** Pre-tax collected / recognized (negative for expenses) */
  baseCents: number;
  taxCents: number;
  /** Total cash movement (base + tax), signed for adjustments/refunds/expenses */
  totalCents: number;
  discountCents: number;
  /** Estimated remaining balance due at studio (appointments only) */
  balanceDueCents: number;
  appointmentId: string | null;
  couponCode: string | null;
  expenseCategory: string | null;
};

export type RevenueBreakdownItem = {
  key: string;
  label: string;
  totalCents: number;
  count: number;
};

export type DailyPoint = {
  date: string;
  totalCents: number;
  count: number;
};

export type RevenueReport = {
  from: string;
  to: string;
  basis: RevenueBasis;
  timezone: string;
  summary: {
    collectedCents: number;
    taxCents: number;
    discountCents: number;
    netExTaxCents: number;
    outstandingCents: number;
    pendingPaymentCents: number;
    packageSalesCents: number;
    adjustmentNetCents: number;
    appointmentCount: number;
    packageCount: number;
    refundCents: number;
    expenseCents: number;
    expenseTaxCents: number;
    expenseCount: number;
    /** Collected − expenses (includes expense tax) */
    profitCents: number;
  };
  byDay: DailyPoint[];
  byStaff: RevenueBreakdownItem[];
  byCategory: RevenueBreakdownItem[];
  byPaymentMode: RevenueBreakdownItem[];
  byExpenseCategory: RevenueBreakdownItem[];
  ledger: LedgerRow[];
};

export const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Rent" },
  { id: "supplies", label: "Supplies" },
  { id: "payroll", label: "Payroll" },
  { id: "marketing", label: "Marketing" },
  { id: "utilities", label: "Utilities" },
  { id: "equipment", label: "Equipment" },
  { id: "insurance", label: "Insurance" },
  { id: "software", label: "Software" },
  { id: "contractor", label: "Contractor" },
  { id: "other", label: "Other" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function expenseCategoryLabel(id: string) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function dateKeyInTz(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function resolveRevenueRange(
  preset: RevenueRangePreset,
  fromParam?: string | null,
  toParam?: string | null,
  now = new Date(),
) {
  if (preset === "custom" && fromParam && toParam) {
    const from = startOfDay(new Date(fromParam));
    const to = endOfDay(new Date(toParam));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) return { from, to };
  }
  const end = endOfDay(now);
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: end };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: end };
    case "mtd":
      return { from: startOfMonth(now), to: end };
    case "ytd":
      return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: end };
    case "30d":
    default:
      return { from: startOfDay(subDays(now, 29)), to: end };
  }
}

/** Estimated unpaid remainder on a deposit booking. */
export function estimateBalanceDueCents(row: {
  status: string;
  paymentMode: string;
  priceCents: number;
  amountChargedCents: number;
  taxCents: number;
  discountCents: number;
}) {
  if (row.status === "cancelled" || row.status === "expired" || row.status === "no_show") return 0;
  if (row.paymentMode !== "deposit") return 0;
  const chargedBase = Math.max(0, row.amountChargedCents - row.taxCents);
  const serviceNet = Math.max(0, row.priceCents - (row.discountCents || 0));
  return Math.max(0, serviceNet - chargedBase);
}

function bump(
  map: Map<string, RevenueBreakdownItem>,
  key: string,
  label: string,
  totalCents: number,
) {
  const cur = map.get(key) || { key, label, totalCents: 0, count: 0 };
  cur.totalCents += totalCents;
  cur.count += 1;
  map.set(key, cur);
}

export async function buildRevenueReport(
  db: Database,
  input: {
    from: Date;
    to: Date;
    basis: RevenueBasis;
    timezone: string;
    staffId?: string | null;
  },
): Promise<RevenueReport> {
  const { from, to, basis, timezone, staffId } = input;

  const paidStatuses = ["confirmed", "completed"] as const;

  const appointments =
    basis === "accrual"
      ? await db.appointment.findMany({
          where: {
            startsAt: { gte: from, lte: to },
            ...(staffId ? { staffId } : {}),
            status: { in: ["confirmed", "completed", "pending_payment"] },
          },
          include: {
            category: { select: { id: true, title: true } },
            staff: { select: { id: true, name: true } },
            lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
            service: { select: { title: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 2000,
        })
      : await db.appointment.findMany({
          where: {
            updatedAt: { gte: from, lte: to },
            ...(staffId ? { staffId } : {}),
            status: { in: ["confirmed", "completed", "pending_payment"] },
          },
          include: {
            category: { select: { id: true, title: true } },
            staff: { select: { id: true, name: true } },
            lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
            service: { select: { title: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 2000,
        });

  const packages = await db.clientPackage.findMany({
    where: {
      purchasedAt: { gte: from, lte: to },
    },
    include: {
      package: { select: { title: true, priceCents: true } },
      client: { select: { name: true, email: true } },
    },
    orderBy: { purchasedAt: "desc" },
    take: 1000,
  });

  const adjustments = await db.accountingAdjustment.findMany({
    where: {
      occurredAt: { gte: from, lte: to },
    },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });

  const expenses = await db.accountingExpense.findMany({
    where: {
      occurredAt: { gte: from, lte: to },
    },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });

  const ledger: LedgerRow[] = [];
  const byDay = new Map<string, DailyPoint>();
  const byStaff = new Map<string, RevenueBreakdownItem>();
  const byCategory = new Map<string, RevenueBreakdownItem>();
  const byPaymentMode = new Map<string, RevenueBreakdownItem>();
  const byExpenseCategory = new Map<string, RevenueBreakdownItem>();

  let collectedCents = 0;
  let taxCents = 0;
  let discountCents = 0;
  let outstandingCents = 0;
  let pendingPaymentCents = 0;
  let appointmentCount = 0;
  let packageSalesCents = 0;
  let packageCount = 0;
  let adjustmentNetCents = 0;
  let refundCents = 0;
  let expenseCents = 0;
  let expenseTaxCents = 0;
  let expenseCount = 0;

  function addDay(date: Date, total: number) {
    const key = dateKeyInTz(date, timezone);
    const cur = byDay.get(key) || { date: key, totalCents: 0, count: 0 };
    cur.totalCents += total;
    cur.count += 1;
    byDay.set(key, cur);
  }

  for (const row of appointments) {
    const title = appointmentDisplayTitle(row);
    const occurredAt = basis === "accrual" ? row.startsAt : row.updatedAt;
    const balanceDue = estimateBalanceDueCents(row);
    outstandingCents += balanceDue;

    if (row.status === "pending_payment") {
      pendingPaymentCents += row.amountChargedCents || 0;
      ledger.push({
        id: `apt-${row.id}`,
        kind: "appointment",
        typeLabel: "Pending payment",
        occurredAt: occurredAt.toISOString(),
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        description: title,
        staffName: row.staff?.name || null,
        status: row.status,
        paymentMode: row.paymentMode,
        baseCents: Math.max(0, row.amountChargedCents - row.taxCents),
        taxCents: row.taxCents,
        totalCents: row.amountChargedCents,
        discountCents: row.discountCents,
        balanceDueCents: balanceDue,
        appointmentId: row.id,
        couponCode: row.couponCode,
        expenseCategory: null,
      });
      continue;
    }

    if (!paidStatuses.includes(row.status as (typeof paidStatuses)[number])) continue;
    if (row.amountChargedCents <= 0 && balanceDue <= 0) continue;

    if (row.amountChargedCents > 0) {
      appointmentCount += 1;
      const base = Math.max(0, row.amountChargedCents - row.taxCents);
      collectedCents += row.amountChargedCents;
      taxCents += row.taxCents;
      discountCents += row.discountCents || 0;
      addDay(occurredAt, row.amountChargedCents);
      bump(byStaff, row.staffId || "unassigned", row.staff?.name || "Unassigned", row.amountChargedCents);
      bump(byCategory, row.categoryId, row.category.title, row.amountChargedCents);
      bump(byPaymentMode, row.paymentMode, row.paymentMode, row.amountChargedCents);
    }

    ledger.push({
      id: `apt-${row.id}`,
      kind: "appointment",
      typeLabel: row.paymentMode === "deposit" ? "Deposit collected" : "Appointment payment",
      occurredAt: occurredAt.toISOString(),
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      description: title,
      staffName: row.staff?.name || null,
      status: row.status,
      paymentMode: row.paymentMode,
      baseCents: Math.max(0, row.amountChargedCents - row.taxCents),
      taxCents: row.taxCents,
      totalCents: row.amountChargedCents,
      discountCents: row.discountCents,
      balanceDueCents: balanceDue,
      appointmentId: row.id,
      couponCode: row.couponCode,
      expenseCategory: null,
    });
  }

  for (const pack of packages) {
    const total = pack.package.priceCents;
    packageCount += 1;
    packageSalesCents += total;
    collectedCents += total;
    addDay(pack.purchasedAt, total);
    bump(byPaymentMode, "package", "package", total);
    ledger.push({
      id: `pkg-${pack.id}`,
      kind: "package",
      typeLabel: "Package sale",
      occurredAt: pack.purchasedAt.toISOString(),
      clientName: pack.client.name,
      clientEmail: pack.client.email,
      description: pack.package.title,
      staffName: null,
      status: pack.status,
      paymentMode: "full",
      baseCents: total,
      taxCents: 0,
      totalCents: total,
      discountCents: 0,
      balanceDueCents: 0,
      appointmentId: null,
      couponCode: null,
      expenseCategory: null,
    });
  }

  for (const adj of adjustments) {
    const total = adj.amountCents + adj.taxCents;
    adjustmentNetCents += total;
    collectedCents += total;
    taxCents += adj.taxCents;
    if (total < 0) refundCents += Math.abs(total);
    addDay(adj.occurredAt, total);
    bump(byPaymentMode, adj.type, adj.type, total);
    ledger.push({
      id: `adj-${adj.id}`,
      kind: "adjustment",
      typeLabel: adj.type.replace(/_/g, " "),
      occurredAt: adj.occurredAt.toISOString(),
      clientName: adj.clientEmail || "—",
      clientEmail: adj.clientEmail || "",
      description: adj.note || adj.type,
      staffName: null,
      status: "posted",
      paymentMode: null,
      baseCents: adj.amountCents,
      taxCents: adj.taxCents,
      totalCents: total,
      discountCents: 0,
      balanceDueCents: 0,
      appointmentId: adj.appointmentId,
      couponCode: null,
      expenseCategory: null,
    });
  }

  for (const exp of expenses) {
    const total = exp.amountCents + exp.taxCents;
    expenseCount += 1;
    expenseCents += total;
    expenseTaxCents += exp.taxCents;
    addDay(exp.occurredAt, -total);
    bump(byExpenseCategory, exp.category, expenseCategoryLabel(exp.category), total);
    const desc = [exp.vendor, exp.note].filter(Boolean).join(" — ") || expenseCategoryLabel(exp.category);
    ledger.push({
      id: `exp-${exp.id}`,
      kind: "expense",
      typeLabel: `Expense · ${expenseCategoryLabel(exp.category)}`,
      occurredAt: exp.occurredAt.toISOString(),
      clientName: exp.vendor || "—",
      clientEmail: "",
      description: desc,
      staffName: null,
      status: "posted",
      paymentMode: null,
      baseCents: -exp.amountCents,
      taxCents: -exp.taxCents,
      totalCents: -total,
      discountCents: 0,
      balanceDueCents: 0,
      appointmentId: null,
      couponCode: null,
      expenseCategory: exp.category,
    });
  }

  ledger.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const dayKeys: string[] = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    dayKeys.push(dateKeyInTz(cursor, timezone));
    cursor = addDays(cursor, 1);
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    basis,
    timezone,
    summary: {
      collectedCents,
      taxCents,
      discountCents,
      netExTaxCents: collectedCents - taxCents,
      outstandingCents,
      pendingPaymentCents,
      packageSalesCents,
      adjustmentNetCents,
      appointmentCount,
      packageCount,
      refundCents,
      expenseCents,
      expenseTaxCents,
      expenseCount,
      profitCents: collectedCents - expenseCents,
    },
    byDay: dayKeys.map((date) => byDay.get(date) || { date, totalCents: 0, count: 0 }),
    byStaff: [...byStaff.values()].sort((a, b) => b.totalCents - a.totalCents),
    byCategory: [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents),
    byPaymentMode: [...byPaymentMode.values()].sort((a, b) => b.totalCents - a.totalCents),
    byExpenseCategory: [...byExpenseCategory.values()].sort((a, b) => b.totalCents - a.totalCents),
    ledger,
  };
}

export function revenueReportToCsv(report: RevenueReport) {
  const header = [
    "occurredAt",
    "kind",
    "type",
    "clientName",
    "clientEmail",
    "description",
    "staff",
    "status",
    "paymentMode",
    "expenseCategory",
    "baseCad",
    "taxCad",
    "totalCad",
    "discountCad",
    "balanceDueCad",
    "coupon",
    "appointmentId",
  ];
  const lines = [header.join(",")];
  for (const row of report.ledger) {
    const cols = [
      row.occurredAt,
      row.kind,
      row.typeLabel,
      csvEscape(row.clientName),
      csvEscape(row.clientEmail),
      csvEscape(row.description),
      csvEscape(row.staffName || ""),
      row.status,
      row.paymentMode || "",
      row.expenseCategory || "",
      (row.baseCents / 100).toFixed(2),
      (row.taxCents / 100).toFixed(2),
      (row.totalCents / 100).toFixed(2),
      (row.discountCents / 100).toFixed(2),
      (row.balanceDueCents / 100).toFixed(2),
      csvEscape(row.couponCode || ""),
      row.appointmentId || "",
    ];
    lines.push(cols.join(","));
  }
  lines.push("");
  lines.push(`Summary collected,${(report.summary.collectedCents / 100).toFixed(2)}`);
  lines.push(`Tax,${(report.summary.taxCents / 100).toFixed(2)}`);
  lines.push(`Net ex-tax,${(report.summary.netExTaxCents / 100).toFixed(2)}`);
  lines.push(`Expenses,${(report.summary.expenseCents / 100).toFixed(2)}`);
  lines.push(`Profit,${(report.summary.profitCents / 100).toFixed(2)}`);
  lines.push(`Outstanding balances,${(report.summary.outstandingCents / 100).toFixed(2)}`);
  lines.push(`Generated,${format(new Date(), "yyyy-MM-dd HH:mm")}`);
  return lines.join("\n");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export { formatCad };
