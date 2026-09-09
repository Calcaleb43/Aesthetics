import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi({ permission: "inquiries" });
  if ("error" in gate) return gate.error;
  const rows = await gate.db.inquiry.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApi({ permission: "inquiries" });
  if ("error" in gate) return gate.error;
  const parsed = z
    .object({
      id: z.string().min(1),
      status: z.enum(["new", "read", "archived"]),
    })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.inquiry.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "inquiries" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await gate.db.inquiry.delete({ where: { id: parsed.data.id } });
  revalidateSite();
  return NextResponse.json({ ok: true });
}
