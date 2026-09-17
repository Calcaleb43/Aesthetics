import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { announceAppointmentUpdated } from "@/lib/booking/announce";

const schema = z.object({
  id: z.string().uuid(),
  changeLines: z.array(z.string().min(1).max(240)).min(1).max(20),
});

/** Alert the client (email + SMS) after an admin booking edit. */
export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notify payload" }, { status: 400 });
  }

  const existing = await gate.db.appointment.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, staffId: true, status: true, clientEmail: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (gate.session.role === "staff" && existing.staffId !== gate.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status !== "confirmed" && existing.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Only active bookings can notify the client" },
      { status: 400 },
    );
  }

  await announceAppointmentUpdated(gate.db, existing.id, parsed.data.changeLines);
  return NextResponse.json({ ok: true });
}
