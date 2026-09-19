import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertClient } from "@/lib/booking/clients";
import { formatCad, taxOn } from "@/lib/booking/money";
import { createStripeCheckoutSession } from "@/lib/booking/payments";
import { hasStripe, siteUrl } from "@/lib/booking/stripe";
import { getSettings } from "@/lib/content/queries";
import { getPrisma, hasDatabase } from "@/lib/db";

const schema = z.object({
  packageId: z.string().uuid(),
  clientName: z.string().min(1).max(160),
  clientEmail: z.string().email().max(255),
  clientPhone: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }
  if (!hasStripe()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid package checkout details" }, { status: 400 });
  }

  const db = getPrisma();
  const settings = await getSettings();

  const offer = await db.packageOffer.findFirst({
    where: { id: parsed.data.packageId, active: true },
  });
  if (!offer) {
    return NextResponse.json({ error: "Package not available" }, { status: 404 });
  }

  const clientName = parsed.data.clientName.trim();
  const clientEmail = parsed.data.clientEmail.trim().toLowerCase();
  const clientPhone = parsed.data.clientPhone.trim();

  await upsertClient(db, {
    email: clientEmail,
    name: clientName,
    phone: clientPhone,
  });

  const baseCents = offer.priceCents;
  const taxCents = taxOn(baseCents, settings.hstRateBps);
  const totalCents = baseCents + taxCents;

  try {
    const session = await createStripeCheckoutSession({
      mode: "payment",
      customer_email: clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: totalCents,
            product_data: {
              name: `Package — ${offer.title}`.slice(0, 120),
              description: `${offer.sessionCount} session${offer.sessionCount === 1 ? "" : "s"} · ${formatCad(baseCents)} + HST ${formatCad(taxCents)}`,
            },
          },
        },
      ],
      metadata: {
        type: "package",
        packageId: offer.id,
        clientEmail,
        clientName,
        clientPhone,
      },
      success_url: `${siteUrl()}/packages?purchased=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/packages?cancelled=1`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not start package checkout" }, { status: 500 });
  }
}
