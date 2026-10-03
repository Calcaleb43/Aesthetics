import type { Database } from "@/lib/db";

export type ClientContact = {
  email: string;
  name: string;
  phone?: string | null;
};

/**
 * Comparable phone key: digits only, North American leading "1" dropped.
 * Returns null when there are too few digits to identify someone.
 */
export function phoneKey(phone: string | null | undefined) {
  const digits = (phone || "").replace(/\D/g, "");
  const key = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return key.length >= 7 ? key : null;
}

/** Find a client whose stored phone matches `phone` regardless of formatting. */
export async function findClientByPhone(
  db: Database,
  phone: string | null | undefined,
  excludeId?: string,
) {
  const key = phoneKey(phone);
  if (!key) return null;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT id, created_at, regexp_replace(phone, '[^0-9]', '', 'g') AS digits
      FROM clients
      WHERE phone IS NOT NULL
    ) c
    WHERE (
      CASE WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN substr(digits, 2) ELSE digits END
    ) = ${key}
    ORDER BY created_at ASC
  `;
  const match = rows.find((r) => r.id !== excludeId);
  return match ? db.client.findUnique({ where: { id: match.id } }) : null;
}

/**
 * Find-or-create a Client using email OR phone as the identity, so the same person
 * booking with a new email (or a reformatted number) reuses their existing record.
 * Email wins when both match different clients. A phone match keeps the client's
 * original email; the appointment still stores the email used for that booking.
 */
export async function upsertClient(db: Database, contact: ClientContact) {
  const email = contact.email.trim().toLowerCase();
  const name = contact.name.trim();
  const phone = contact.phone?.trim() || null;

  const update = {
    name: name || undefined,
    ...(phone !== null ? { phone } : {}),
  };

  const byEmail = await db.client.findUnique({ where: { email } });
  if (byEmail) {
    return db.client.update({ where: { id: byEmail.id }, data: update });
  }

  const byPhone = await findClientByPhone(db, phone);
  if (byPhone) {
    return db.client.update({ where: { id: byPhone.id }, data: update });
  }

  try {
    return await db.client.create({ data: { email, name, phone } });
  } catch (err) {
    // Concurrent booking created the same email first.
    const existing = await db.client.findUnique({ where: { email } });
    if (existing) return db.client.update({ where: { id: existing.id }, data: update });
    throw err;
  }
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
