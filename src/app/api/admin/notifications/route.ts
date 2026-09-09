import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  const [unread, rows] = await Promise.all([
    gate.db.notification.count({
      where: { adminId: gate.session.sub, readAt: null },
    }),
    gate.db.notification.findMany({
      where: { adminId: gate.session.sub },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    unread,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      readAt: row.readAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  if (parsed.data.markAll) {
    await gate.db.notification.updateMany({
      where: { adminId: gate.session.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await gate.db.notification.updateMany({
    where: { id: parsed.data.id, adminId: gate.session.sub },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
