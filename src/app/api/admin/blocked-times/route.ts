import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  try {
    const where =
      gate.session.role === "staff"
        ? { OR: [{ staffId: null }, { staffId: gate.session.sub }] }
        : {};

    const rows = await gate.db.blockedTime.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: 200,
      include: { staff: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      blocks: rows.map((r) => ({
        id: r.id,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        reason: r.reason,
        staffId: r.staffId,
        staffName: r.staff?.name || null,
      })),
    });
  } catch (err) {
    console.error("blocked-times GET failed", err);
    return NextResponse.json({ error: "Failed to load blocked times" }, { status: 500 });
  }
}

const createSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(200).optional(),
  staffId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (!(startsAt < endsAt)) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  let staffId = parsed.data.staffId ?? null;
  if (gate.session.role === "staff") staffId = gate.session.sub;

  const row = await gate.db.blockedTime.create({
    data: {
      startsAt,
      endsAt,
      reason: parsed.data.reason?.trim() || "",
      staffId,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const existing = await gate.db.blockedTime.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gate.session.role === "staff" && existing.staffId !== gate.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await gate.db.blockedTime.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
