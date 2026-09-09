import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { canManageAllAppointments, canWriteAppointments } from "@/lib/auth/roles";
import { upsertClient } from "@/lib/booking/clients";
import { activeHoldStatuses } from "@/lib/booking/availability";
import { formatCad } from "@/lib/booking/money";
import { buildOccurrenceStarts } from "@/lib/booking/recurrence";
import { emailAppointmentCancelled } from "@/lib/email/resend";
import { notifyAdmins } from "@/lib/notifications";

function whenLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startsAt);
}

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "calendar" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const staffId = url.searchParams.get("staffId");
  const serviceId = url.searchParams.get("serviceId");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (from || to) {
    where.startsAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (serviceId) where.serviceId = serviceId;

  if (gate.session.role === "staff") {
    where.staffId = gate.session.sub;
  } else if (staffId) {
    where.staffId = staffId;
  }

  const rows = await gate.db.appointment.findMany({
    where,
    include: {
      service: { select: { id: true, title: true, slug: true } },
      staff: { select: { id: true, name: true, color: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  const staff = await gate.db.admin.findMany({
    where: {
      active: true,
      OR: [{ role: { in: ["staff", "owner", "manager"] } }],
    },
    select: { id: true, name: true, color: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    role: gate.session.role,
    canWrite: canWriteAppointments(gate.session.role),
    canManageAll: canManageAllAppointments(gate.session.role),
    staff,
    appointments: rows.map((row) => ({
      id: row.id,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      clientId: row.clientId,
      seriesId: row.seriesId,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      notes: row.notes,
      paymentMode: row.paymentMode,
      amountChargedCents: row.amountChargedCents,
      amountLabel: formatCad(row.amountChargedCents),
      priceLabel: formatCad(row.priceCents),
      serviceId: row.service.id,
      serviceTitle: row.serviceLabel || row.service.title,
      serviceSlug: row.service.slug,
      serviceLabel: row.serviceLabel,
      staffId: row.staffId,
      staffName: row.staff?.name || null,
      staffColor: row.staff?.color || "#c6a75e",
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z
    .enum(["confirmed", "cancelled", "completed", "no_show", "expired", "pending_payment"])
    .optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  staffId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
  clientName: z.string().min(1).max(160).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().max(64).nullable().optional(),
  serviceId: z.string().uuid().optional(),
  clientId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const existing = await gate.db.appointment.findUnique({
    where: { id: parsed.data.id },
    include: { service: true, staff: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (gate.session.role === "staff" && existing.staffId !== gate.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.clientName !== undefined) data.clientName = parsed.data.clientName;
  if (parsed.data.clientEmail !== undefined) data.clientEmail = parsed.data.clientEmail.trim().toLowerCase();
  if (parsed.data.clientPhone !== undefined) data.clientPhone = parsed.data.clientPhone;
  if (parsed.data.serviceId !== undefined) data.serviceId = parsed.data.serviceId;
  if (parsed.data.staffId !== undefined) {
    if (gate.session.role === "staff") {
      data.staffId = gate.session.sub;
    } else {
      data.staffId = parsed.data.staffId;
    }
  }
  if (parsed.data.startsAt) {
    data.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt) data.endsAt = new Date(parsed.data.endsAt);
    else data.endsAt = addMinutes(new Date(parsed.data.startsAt), existing.service.durationMinutes);
  } else if (parsed.data.endsAt) {
    data.endsAt = new Date(parsed.data.endsAt);
  }

  const name = (parsed.data.clientName ?? existing.clientName).trim();
  const email = (parsed.data.clientEmail ?? existing.clientEmail).trim().toLowerCase();
  const phone =
    parsed.data.clientPhone !== undefined ? parsed.data.clientPhone : existing.clientPhone;

  if (parsed.data.clientName || parsed.data.clientEmail || parsed.data.clientPhone !== undefined) {
    const client = await upsertClient(gate.db, { email, name, phone });
    data.clientId = client.id;
    data.clientName = name;
    data.clientEmail = email;
    data.clientPhone = phone;
  } else if (parsed.data.clientId !== undefined) {
    data.clientId = parsed.data.clientId;
  }

  const updated = await gate.db.appointment.update({
    where: { id: parsed.data.id },
    data,
    include: { service: true, staff: true },
  });

  if (parsed.data.status === "cancelled" && existing.status !== "cancelled") {
    const settings = await gate.db.siteSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone || "America/Toronto";
    const label = whenLabel(updated.startsAt, tz);
    await emailAppointmentCancelled({
      to: updated.clientEmail,
      clientName: updated.clientName,
      serviceTitle: updated.service.title,
      whenLabel: label,
    });
    await notifyAdmins(gate.db, {
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      body: `${updated.clientName} · ${updated.service.title} · ${label}`,
      includeStaffId: updated.staffId,
      metadata: { appointmentId: updated.id },
    });
  }

  return NextResponse.json({ ok: true });
}

const createSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(),
  clientName: z.string().min(1).max(160),
  clientEmail: z.string().email(),
  clientPhone: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["confirmed", "pending_payment"]).optional(),
  recurrence: z
    .object({
      frequency: z.enum(["none", "weekly", "biweekly"]).default("none"),
      count: z.number().int().min(1).max(26).optional(),
      until: z.string().datetime().optional().nullable(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "appointments_write" });
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const service = await gate.db.service.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  let staffId = parsed.data.staffId ?? null;
  if (gate.session.role === "staff") staffId = gate.session.sub;

  const clientName = parsed.data.clientName.trim();
  const clientEmail = parsed.data.clientEmail.trim().toLowerCase();
  const clientPhone = parsed.data.clientPhone || null;

  let clientId = parsed.data.clientId ?? null;
  if (clientId) {
    const existingClient = await gate.db.client.findUnique({ where: { id: clientId } });
    if (!existingClient) clientId = null;
  }
  const client = await upsertClient(gate.db, {
    email: clientEmail,
    name: clientName,
    phone: clientPhone,
  });
  clientId = client.id;

  const firstStartsAt = new Date(parsed.data.startsAt);
  const frequency = parsed.data.recurrence?.frequency || "none";
  const occurrenceStarts = buildOccurrenceStarts({
    firstStartsAt,
    frequency,
    count: parsed.data.recurrence?.count,
    until: parsed.data.recurrence?.until ? new Date(parsed.data.recurrence.until) : null,
  });

  const seriesId = occurrenceStarts.length > 1 ? randomUUID() : null;
  const holds = activeHoldStatuses();
  const created: string[] = [];
  const skipped: { startsAt: string; reason: string }[] = [];
  const status = parsed.data.status || "confirmed";

  for (const startsAt of occurrenceStarts) {
    const endsAt = addMinutes(startsAt, service.durationMinutes);

    if (staffId) {
      const clash = await gate.db.appointment.findFirst({
        where: {
          staffId,
          status: { in: [...holds] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (clash) {
        skipped.push({ startsAt: startsAt.toISOString(), reason: "Staff already booked" });
        continue;
      }
    }

    const row = await gate.db.appointment.create({
      data: {
        serviceId: service.id,
        staffId,
        clientId,
        seriesId,
        startsAt,
        endsAt,
        clientName,
        clientEmail,
        clientPhone,
        notes: parsed.data.notes || "",
        status,
        priceCents: service.priceCents,
        depositCents: service.depositCents,
        taxCents: 0,
        amountChargedCents: 0,
        paymentMode: "none",
        policyAcceptedAt: new Date(),
      },
    });
    created.push(row.id);
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: "No appointments created — all times conflicted", skipped },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: created[0],
    created: created.length,
    skipped,
    seriesId,
  });
}
