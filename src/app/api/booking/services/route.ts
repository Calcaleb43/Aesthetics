import { NextResponse } from "next/server";
import { subMinutes } from "date-fns";
import { PENDING_HOLD_MINUTES } from "@/lib/booking/availability";
import { chargeBreakdown, formatCad } from "@/lib/booking/money";
import { getPrisma, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/content/queries";

function mapChargeable(
  s: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number | null;
    paymentMode: string;
  },
  hstRateBps: number,
) {
  const charge = chargeBreakdown({
    priceCents: s.priceCents,
    depositCents: s.depositCents,
    paymentMode: s.paymentMode,
    hstRateBps,
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
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json(
      { enabled: false, categories: [], addons: [], error: "Booking requires DATABASE_URL or POSTGRES_URL on this environment" },
      { status: 503 },
    );
  }

  const settings = await getSettings();
  if (!settings.bookingEnabled) {
    return NextResponse.json({ enabled: false, categories: [], addons: [], bookingUrl: settings.bookingUrl });
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

    const [categories, addons] = await Promise.all([
      db.serviceCategory.findMany({
        where: {
          status: "published",
          NOT: { slug: "imported-acuity" },
        },
        orderBy: { sortOrder: "asc" },
        include: {
          services: {
            where: { status: "published", bookable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      db.addon.findMany({
        where: { status: "published", bookable: true },
        orderBy: { sortOrder: "asc" },
        include: { categories: { select: { categoryId: true } } },
      }),
    ]);

    return NextResponse.json({
      enabled: true,
      hstRateBps: settings.hstRateBps,
      timezone: settings.timezone,
      categories: categories
        .filter((c) => c.services.length > 0)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          summary: c.summary,
          services: c.services.map((s) => mapChargeable(s, settings.hstRateBps)),
        })),
      addons: addons.map((a) => ({
        ...mapChargeable(a, settings.hstRateBps),
        categoryIds: a.categories.map((c) => c.categoryId),
      })),
    });
  } catch (err) {
    console.error("Booking services error", err);
    return NextResponse.json(
      { enabled: false, categories: [], addons: [], error: "Could not load bookable services" },
      { status: 503 },
    );
  }
}
