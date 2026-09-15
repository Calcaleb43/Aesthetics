import { NextResponse } from "next/server";
import { getPrisma, hasDatabase } from "@/lib/db";

/** Active prepaid packages for a client email (booking redeem). */
export async function GET(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ packages: [] });
  }
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() || "";
  if (!email.includes("@")) {
    return NextResponse.json({ packages: [] });
  }

  const db = getPrisma();
  const client = await db.client.findUnique({ where: { email } });
  if (!client) return NextResponse.json({ packages: [] });

  const rows = await db.clientPackage.findMany({
    where: {
      clientId: client.id,
      status: "active",
      sessionsRemaining: { gt: 0 },
    },
    include: {
      package: {
        include: { services: { select: { serviceId: true } } },
      },
    },
    orderBy: { purchasedAt: "desc" },
  });

  return NextResponse.json({
    packages: rows.map((r) => ({
      id: r.id,
      title: r.package.title,
      sessionsRemaining: r.sessionsRemaining,
      serviceIds: r.package.services.map((s) => s.serviceId),
    })),
  });
}
