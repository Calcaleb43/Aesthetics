import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import {
  EXPENSE_CATEGORIES,
  buildRevenueReport,
  resolveRevenueRange,
  revenueReportToCsv,
  type RevenueBasis,
  type RevenueRangePreset,
} from "@/lib/accounting/revenue";
import { dollarsToCents } from "@/lib/booking/money";
import { getSettings } from "@/lib/content/queries";

const expenseCategoryIds = EXPENSE_CATEGORIES.map((c) => c.id) as [
  (typeof EXPENSE_CATEGORIES)[number]["id"],
  ...(typeof EXPENSE_CATEGORIES)[number]["id"][],
];

function parsePreset(value: string | null): RevenueRangePreset {
  if (value === "today" || value === "7d" || value === "30d" || value === "mtd" || value === "ytd" || value === "custom") {
    return value;
  }
  return "30d";
}

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const preset = parsePreset(url.searchParams.get("preset"));
  const basis = (url.searchParams.get("basis") === "accrual" ? "accrual" : "cash") as RevenueBasis;
  const staffId = url.searchParams.get("staffId");
  const format = url.searchParams.get("format");
  const settings = await getSettings();
  const { from, to } = resolveRevenueRange(
    preset,
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );

  const report = await buildRevenueReport(gate.db, {
    from,
    to,
    basis,
    timezone: settings.timezone,
    staffId: staffId || null,
  });

  if (format === "csv") {
    const csv = revenueReportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="revenue-${report.from.slice(0, 10)}-${report.to.slice(0, 10)}.csv"`,
      },
    });
  }

  const staff = await gate.db.admin.findMany({
    where: { active: true, role: { in: ["staff", "owner", "manager"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ report, staff, expenseCategories: EXPENSE_CATEGORIES });
}

const adjustmentSchema = z.object({
  kind: z.literal("adjustment").optional(),
  type: z.enum(["refund", "adjustment", "offline_payment", "write_off"]),
  /** Dollars; refunds should be negative or we flip for refund type */
  amount: z.number(),
  tax: z.number().optional(),
  note: z.string().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  clientEmail: z.string().email().nullable().optional(),
});

const expenseSchema = z.object({
  kind: z.literal("expense"),
  category: z.enum(expenseCategoryIds),
  amount: z.number().positive(),
  tax: z.number().optional(),
  vendor: z.string().max(160).optional(),
  note: z.string().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const body = await req.json();
  if (body?.kind === "expense") {
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid expense" }, { status: 400 });

    const amountCents = Math.abs(dollarsToCents(parsed.data.amount) ?? 0);
    const taxCents = Math.abs(dollarsToCents(parsed.data.tax ?? 0) ?? 0);
    if (amountCents <= 0) return NextResponse.json({ error: "Amount required" }, { status: 400 });

    const row = await gate.db.accountingExpense.create({
      data: {
        category: parsed.data.category,
        amountCents,
        taxCents,
        vendor: parsed.data.vendor?.trim() || "",
        note: parsed.data.note?.trim() || "",
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
        createdById: gate.session.sub,
      },
    });

    return NextResponse.json({ ok: true, id: row.id, kind: "expense" });
  }

  const parsed = adjustmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  let amountCents = dollarsToCents(parsed.data.amount) ?? 0;
  let taxCents = dollarsToCents(parsed.data.tax ?? 0) ?? 0;
  if (parsed.data.type === "refund" || parsed.data.type === "write_off") {
    amountCents = -Math.abs(amountCents);
    taxCents = -Math.abs(taxCents);
  }

  const row = await gate.db.accountingAdjustment.create({
    data: {
      type: parsed.data.type,
      amountCents,
      taxCents,
      note: parsed.data.note?.trim() || "",
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      appointmentId: parsed.data.appointmentId || null,
      clientEmail: parsed.data.clientEmail?.trim().toLowerCase() || null,
      createdById: gate.session.sub,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, kind: "adjustment" });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = z
    .object({
      id: z.string().uuid(),
      kind: z.enum(["adjustment", "expense"]).default("adjustment"),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  if (parsed.data.kind === "expense") {
    await gate.db.accountingExpense.delete({ where: { id: parsed.data.id } });
  } else {
    await gate.db.accountingAdjustment.delete({ where: { id: parsed.data.id } });
  }
  return NextResponse.json({ ok: true });
}
