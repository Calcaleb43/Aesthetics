import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { announceAppointmentBooked } from "@/lib/booking/announce";
import { getStripe } from "@/lib/booking/stripe";
import { getPrisma, hasDatabase } from "@/lib/db";
import { notifyAdmins } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "No database" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getPrisma();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;
    if (appointmentId) {
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      const result = await db.appointment.updateMany({
        where: {
          id: appointmentId,
          status: { in: ["pending_payment", "expired"] },
        },
        data: {
          status: "confirmed",
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntent,
          amountChargedCents: session.amount_total ?? undefined,
        },
      });

      if (result.count > 0) {
        await announceAppointmentBooked(db, appointmentId);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;
    if (appointmentId) {
      await db.appointment.updateMany({
        where: { id: appointmentId, status: "pending_payment" },
        data: { status: "expired" },
      });
      await notifyAdmins(db, {
        type: "payment_pending_expired",
        title: "Booking payment expired",
        body: "A pending booking hold expired without payment.",
        metadata: { appointmentId },
      });
    }
  }

  return NextResponse.json({ received: true });
}
