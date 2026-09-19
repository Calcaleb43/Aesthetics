import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { estimateBalanceDueCents, formatCad } from "@/lib/booking/money";
import { createBalanceCheckoutSession } from "@/lib/booking/payments";
import { hasStripe } from "@/lib/booking/stripe";
import { notifyAdmins } from "@/lib/notifications";

const OFFLINE_METHODS = ["cash", "etransfer", "card"] as const;

const schema = z.object({
  id: z.string().uuid(),
  method: z.enum(["stripe", "cash", "etransfer", "card"]),
  /** Optional partial amount in dollars for offline methods; defaults to full remaining balance */
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

const METHOD_LABEL: Record<(typeof OFFLINE_METHODS)[number], string> = {
  cash: "cash",
  etransfer: "e-transfer",
  card: "card at studio",
};

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const row = await gate.db.appointment.findUnique({
    where: { id: parsed.data.id },
    include: {
      service: { select: { title: true } },
      category: { select: { title: true } },
      lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (gate.session.role === "staff" && row.staffId !== gate.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await gate.db.siteSettings.findUnique({ where: { id: 1 } });
  const hstRateBps = settings?.hstRateBps ?? 1300;
  const balanceDueCents = estimateBalanceDueCents(row, hstRateBps);
  if (balanceDueCents <= 0) {
    return NextResponse.json({ error: "No balance due on this appointment" }, { status: 400 });
  }

  const serviceTitle = appointmentDisplayTitle(row);

  if (parsed.data.method === "stripe") {
    if (!hasStripe()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
    }
    const session = await createBalanceCheckoutSession({
      appointmentId: row.id,
      clientEmail: row.clientEmail,
      serviceLabel: serviceTitle,
      balanceDueCents,
    });
    await gate.db.appointment.update({
      where: { id: row.id },
      data: { stripeCheckoutUrl: session.checkoutUrl },
    });
    return NextResponse.json({
      ok: true,
      method: "stripe",
      checkoutUrl: session.checkoutUrl,
      balanceDueCents,
      balanceDueLabel: formatCad(balanceDueCents),
    });
  }

  const method = parsed.data.method;
  const dollars = parsed.data.amount;
  const collectCents =
    dollars != null ? Math.min(balanceDueCents, Math.round(dollars * 100)) : balanceDueCents;
  if (collectCents <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const nextCharged = row.amountChargedCents + collectCents;
  const remaining = estimateBalanceDueCents(
    { ...row, amountChargedCents: nextCharged },
    hstRateBps,
  );

  const methodLabel = METHOD_LABEL[method];
  const noteLine = `[Balance ${formatCad(collectCents)} received ${parsed.data.note?.trim() || methodLabel}]`;
  await gate.db.appointment.update({
    where: { id: row.id },
    data: {
      amountChargedCents: nextCharged,
      ...(remaining <= 0 ? { paymentMode: "full" } : {}),
      notes: row.notes ? `${row.notes}\n${noteLine}` : noteLine,
    },
  });

  await gate.db.accountingAdjustment.create({
    data: {
      type: "offline_payment",
      amountCents: collectCents,
      taxCents: 0,
      note: `Balance for ${serviceTitle} — ${row.clientName} (${methodLabel})`,
      appointmentId: row.id,
      clientEmail: row.clientEmail,
      createdById: gate.session.sub,
      occurredAt: new Date(),
    },
  });

  await notifyAdmins(gate.db, {
    type: "balance_collected",
    title: `Balance collected (${methodLabel})`,
    body: `${row.clientName} · ${formatCad(collectCents)} · ${serviceTitle}`,
    href: "/admin/payments",
    includeStaffId: row.staffId,
    metadata: { appointmentId: row.id, amountCents: collectCents, method },
  });

  return NextResponse.json({
    ok: true,
    method,
    collectedCents: collectCents,
    collectedLabel: formatCad(collectCents),
    remainingCents: remaining,
    remainingLabel: formatCad(remaining),
  });
}
