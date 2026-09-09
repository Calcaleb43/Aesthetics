import type { Database } from "@/lib/db";

export type ClientContact = {
  email: string;
  name: string;
  phone?: string | null;
};

/** Upsert Client by lowercased email; refresh name/phone when provided. */
export async function upsertClient(db: Database, contact: ClientContact) {
  const email = contact.email.trim().toLowerCase();
  const name = contact.name.trim();
  const phone = contact.phone?.trim() || null;

  return db.client.upsert({
    where: { email },
    create: {
      email,
      name,
      phone,
    },
    update: {
      name: name || undefined,
      ...(phone !== null ? { phone } : {}),
    },
  });
}

export async function backfillClientsFromAppointments(db: Database) {
  const rows = await db.appointment.findMany({
    where: { clientId: null },
    select: {
      id: true,
      clientEmail: true,
      clientName: true,
      clientPhone: true,
      startsAt: true,
    },
    orderBy: { startsAt: "desc" },
  });

  const byEmail = new Map<
    string,
    { name: string; phone: string | null; appointmentIds: string[] }
  >();

  for (const row of rows) {
    const email = row.clientEmail.trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        name: row.clientName,
        phone: row.clientPhone,
        appointmentIds: [row.id],
      });
    } else {
      existing.appointmentIds.push(row.id);
    }
  }

  let linked = 0;
  for (const [email, info] of byEmail) {
    const client = await upsertClient(db, {
      email,
      name: info.name,
      phone: info.phone,
    });
    await db.appointment.updateMany({
      where: { id: { in: info.appointmentIds } },
      data: { clientId: client.id },
    });
    linked += info.appointmentIds.length;
  }

  return { clients: byEmail.size, linked };
}
