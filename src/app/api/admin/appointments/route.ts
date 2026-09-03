import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { formatCad } from "@/lib/booking/money";

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (from || to) {
    where.startsAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const rows = await gate.db.appointment.findMany({
    where,
    include: { service: { select: { title: true, slug: true } } },
    orderBy: { startsAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    appointments: rows.map((row) => ({
      id: row.id,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      notes: row.notes,
      paymentMode: row.paymentMode,
      amountChargedCents: row.amountChargedCents,
      amountLabel: formatCad(row.amountChargedCents),
      priceLabel: formatCad(row.priceCents),
      serviceTitle: row.service.title,
      serviceSlug: row.service.slug,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show", "expired"]),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.appointment.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
