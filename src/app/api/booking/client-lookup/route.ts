import { NextResponse } from "next/server";
import { getPrisma, hasDatabase } from "@/lib/db";

const recentLookups = new Map<string, number>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function rateLimited(key: string) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  for (const [k, t] of recentLookups) {
    if (t < cutoff) recentLookups.delete(k);
  }
  const hits = [...recentLookups.entries()].filter(([k, t]) => k.startsWith(key) && t >= cutoff).length;
  if (hits >= MAX_PER_WINDOW) return true;
  recentLookups.set(`${key}:${now}:${Math.random()}`, now);
  return false;
}

export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ found: false });
  }

  const emailRaw = new URL(req.url).searchParams.get("email") || "";
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 255) {
    return NextResponse.json({ found: false });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const db = getPrisma();
  const client = await db.client.findUnique({
    where: { email },
    select: { name: true, phone: true },
  });
  if (client) {
    return NextResponse.json({
      found: true,
      name: client.name,
      phone: client.phone,
    });
  }

  const appt = await db.appointment.findFirst({
    where: { clientEmail: email },
    orderBy: { startsAt: "desc" },
    select: { clientName: true, clientPhone: true },
  });
  if (!appt) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    name: appt.clientName,
    phone: appt.clientPhone,
  });
}
