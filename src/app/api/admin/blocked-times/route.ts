import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const rows = await gate.db.blockedTime.findMany({ orderBy: { startsAt: "asc" }, take: 100 });
  return NextResponse.json({
    blocks: rows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      reason: r.reason,
    })),
  });
}

const createSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (!(startsAt < endsAt)) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  const row = await gate.db.blockedTime.create({
    data: {
      startsAt,
      endsAt,
      reason: parsed.data.reason?.trim() || "",
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await gate.db.blockedTime.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
