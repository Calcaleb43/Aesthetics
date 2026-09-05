import { NextResponse } from "next/server";
import { subMinutes } from "date-fns";
import { PENDING_HOLD_MINUTES } from "@/lib/booking/availability";
import { chargeBreakdown, formatCad } from "@/lib/booking/money";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json(
      { enabled: false, services: [], error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const settings = await getSettings();
  if (!settings.bookingEnabled) {
    return NextResponse.json({ enabled: false, services: [], bookingUrl: settings.bookingUrl });
  }

  try {
    const db = getPrisma();
    await db.appointment.updateMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: subMinutes(new Date(), PENDING_HOLD_MINUTES) },
      },
      data: { status: "expired" },
    });

    const rows = await db.service.findMany({
      where: { status: "published", bookable: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      enabled: true,
      hstRateBps: settings.hstRateBps,
      timezone: settings.timezone,
      services: rows.map((s) => {
        const charge = chargeBreakdown({
          priceCents: s.priceCents,
          depositCents: s.depositCents,
          paymentMode: s.paymentMode,
          hstRateBps: settings.hstRateBps,
        });
        return {
          id: s.id,
          slug: s.slug,
          title: s.title,
          summary: s.summary,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          depositCents: s.depositCents,
          paymentMode: s.paymentMode,
          priceLabel: formatCad(s.priceCents),
          chargeLabel: formatCad(charge.totalCents),
          chargeBaseLabel: formatCad(charge.baseCents),
          taxLabel: formatCad(charge.taxCents),
          chargeTotalCents: charge.totalCents,
        };
      }),
    });
  } catch (err) {
    console.error("Booking services error", err);
    return NextResponse.json(
      { enabled: false, services: [], error: "Could not load bookable services" },
      { status: 503 },
    );
  }
}
