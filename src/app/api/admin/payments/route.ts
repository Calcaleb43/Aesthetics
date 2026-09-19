import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { canWriteAppointments } from "@/lib/auth/roles";
import { appointmentDisplayTitle } from "@/lib/booking/labels";
import { estimateBalanceDueCents, formatCad } from "@/lib/booking/money";

/** List bookings with an outstanding balance (deposit remainder or pay-at-studio). */
export async function GET() {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  const where: Record<string, unknown> = {
    status: { notIn: ["cancelled", "expired", "no_show"] },
    paymentMode: { in: ["deposit", "none"] },
  };
  if (gate.session.role === "staff") {
    where.staffId = gate.session.sub;
  }

  const [rows, settings] = await Promise.all([
    gate.db.appointment.findMany({
      where,
      include: {
        service: { select: { title: true } },
        category: { select: { title: true } },
        lines: { orderBy: { sortOrder: "asc" }, select: { title: true } },
        staff: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
    gate.db.siteSettings.findUnique({ where: { id: 1 }, select: { hstRateBps: true, timezone: true } }),
  ]);

  const hstRateBps = settings?.hstRateBps ?? 1300;
  const payments = rows.flatMap((row) => {
    const balanceDueCents = estimateBalanceDueCents(row, hstRateBps);
    if (balanceDueCents <= 0) return [];
    return [
      {
        id: row.id,
        status: row.status,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        clientId: row.clientId,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        clientPhone: row.clientPhone,
        notes: row.notes,
        paymentMode: row.paymentMode,
        priceCents: row.priceCents,
        depositCents: row.depositCents,
        taxCents: row.taxCents,
        discountCents: row.discountCents,
        amountChargedCents: row.amountChargedCents,
        amountLabel: formatCad(row.amountChargedCents),
        priceLabel: formatCad(row.priceCents),
        balanceDueCents,
        balanceDueLabel: formatCad(balanceDueCents),
        serviceTitle: appointmentDisplayTitle(row),
        staffId: row.staffId,
        staffName: row.staff?.name || null,
        staffColor: row.staff?.color || "#c6a75e",
      },
    ];
  });

  const totalOutstandingCents = payments.reduce((sum, row) => sum + row.balanceDueCents, 0);

  return NextResponse.json({
    canWrite: canWriteAppointments(gate.session.role),
    timezone: settings?.timezone || "America/Toronto",
    hstRateBps,
    totalOutstandingCents,
    totalOutstandingLabel: formatCad(totalOutstandingCents),
    payments,
  });
}
