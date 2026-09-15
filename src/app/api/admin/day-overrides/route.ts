import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { weeklyWindowSchema } from "@/lib/booking/weekly-hours";

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().nullable().optional(),
  closed: z.boolean(),
  windows: z.array(weeklyWindowSchema).default([]),
  note: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const staffId = url.searchParams.get("staffId");

  const rows = await gate.db.dayOverride.findMany({
    where: {
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
      ...(staffId === "studio"
        ? { staffId: null }
        : staffId
          ? { OR: [{ staffId: null }, { staffId }] }
          : {}),
    },
    orderBy: { date: "asc" },
    take: 400,
  });

  return NextResponse.json({
    overrides: rows.map((r) => ({
      id: r.id,
      date: r.date,
      staffId: r.staffId,
      closed: r.closed,
      windows: r.windows,
      note: r.note,
    })),
  });
}

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const staffId = parsed.data.staffId ?? null;
  const data = {
    date: parsed.data.date,
    staffId,
    closed: parsed.data.closed,
    windows: parsed.data.closed ? [] : parsed.data.windows,
    note: parsed.data.note || "",
  };

  const existing = await gate.db.dayOverride.findFirst({
    where: { date: data.date, staffId: data.staffId },
  });

  const row = existing
    ? await gate.db.dayOverride.update({ where: { id: existing.id }, data })
    : await gate.db.dayOverride.create({ data });

  revalidateSite();
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      staffId: z.string().uuid().nullable().optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  if (parsed.data.id) {
    await gate.db.dayOverride.delete({ where: { id: parsed.data.id } });
  } else if (parsed.data.date) {
    await gate.db.dayOverride.deleteMany({
      where: {
        date: parsed.data.date,
        staffId: parsed.data.staffId ?? null,
      },
    });
  } else {
    return NextResponse.json({ error: "id or date required" }, { status: 400 });
  }

  revalidateSite();
  return NextResponse.json({ ok: true });
}
