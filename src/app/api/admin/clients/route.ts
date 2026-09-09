import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { upsertClient } from "@/lib/booking/clients";
import { formatCad } from "@/lib/booking/money";

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "clients" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const id = url.searchParams.get("id");

  if (id) {
    const client = await gate.db.client.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 200,
          include: { service: { select: { title: true, slug: true } } },
        },
      },
    });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      client: {
        id: client.id,
        email: client.email,
        name: client.name,
        phone: client.phone,
        notes: client.notes,
        banned: client.banned,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        appointments: client.appointments.map((a) => ({
          id: a.id,
          status: a.status,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          serviceTitle: a.serviceLabel || a.service.title,
          serviceSlug: a.service.slug,
          serviceLabel: a.serviceLabel,
          priceLabel: formatCad(a.priceCents),
          amountLabel: formatCad(a.amountChargedCents),
          notes: a.notes,
        })),
      },
    });
  }

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q.toLowerCase(), mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const pageSizeRaw = Number(url.searchParams.get("pageSize") || "25");
  const pageRaw = Number(url.searchParams.get("page") || "1");
  const pageSize = Math.min(100, Math.max(10, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25));
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    gate.db.client.count({ where }),
    gate.db.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { appointments: true } },
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { startsAt: true, status: true },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    page,
    pageSize,
    total,
    totalPages,
    clients: rows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      banned: c.banned,
      appointmentCount: c._count.appointments,
      lastVisitAt: c.appointments[0]?.startsAt.toISOString() || null,
      lastStatus: c.appointments[0]?.status || null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(255),
  phone: z.string().max(64).nullable().optional(),
  notes: z.string().max(4000).optional(),
  banned: z.boolean().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApi({ permission: "clients" });
  if ("error" in gate) return gate.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await gate.db.client.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A client with that email already exists", id: existing.id },
      { status: 409 },
    );
  }

  const client = await upsertClient(gate.db, {
    email,
    name: parsed.data.name,
    phone: parsed.data.phone,
  });

  await gate.db.client.update({
    where: { id: client.id },
    data: {
      notes: parsed.data.notes?.trim() || "",
      banned: parsed.data.banned || false,
    },
  });

  return NextResponse.json({ ok: true, id: client.id });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(64).nullable().optional(),
  notes: z.string().max(4000).optional(),
  banned: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const gate = await requireAdminApi({ permission: "clients" });
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const existing = await gate.db.client.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone?.trim() || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.banned !== undefined) data.banned = parsed.data.banned;
  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase();
    if (email !== existing.email) {
      const clash = await gate.db.client.findUnique({ where: { email } });
      if (clash) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      data.email = email;
    }
  }

  await gate.db.client.update({ where: { id: parsed.data.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi({ permission: "clients" });
  if ("error" in gate) return gate.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const future = await gate.db.appointment.count({
    where: {
      clientId: parsed.data.id,
      startsAt: { gte: new Date() },
      status: { in: ["confirmed", "pending_payment"] },
    },
  });
  if (future > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${future} upcoming appointment(s)` },
      { status: 409 },
    );
  }

  await gate.db.appointment.updateMany({
    where: { clientId: parsed.data.id },
    data: { clientId: null },
  });
  await gate.db.client.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
