import { formatCad } from "@/lib/booking/money";
import { getStripe, hasStripe, siteUrl } from "@/lib/booking/stripe";

export const PAYMENT_PROVIDERS = ["stripe", "none"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export function isPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export function normalizePaymentProvider(value: string | null | undefined): PaymentProvider {
  if (value && isPaymentProvider(value)) return value;
  return "stripe";
}

/** Whether env credentials for the selected provider are present (never returns secrets). */
export function paymentProviderConfigured(provider: PaymentProvider): boolean {
  switch (provider) {
    case "stripe":
      return hasStripe();
    case "none":
      return true;
    default:
      return false;
  }
}

export function paymentProviderLabel(provider: PaymentProvider) {
  switch (provider) {
    case "stripe":
      return "Stripe";
    case "none":
      return "None (confirm without online payment)";
    default:
      return provider;
  }
}

/** Env readiness for admin UI — boolean flags only, no secret values. */
export function paymentEnvStatus() {
  return {
    stripe: {
      secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
      webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      publishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      ready: hasStripe(),
    },
  };
}

export type CheckoutSessionInput = {
  provider: PaymentProvider;
  appointmentId: string;
  clientEmail: string;
  serviceLabel: string;
  categoryId: string;
  serviceIds: string[];
  addonIds: string[];
  paymentMode: string;
  baseCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * Create a hosted checkout session for the active provider.
 * Credentials are always read from environment variables.
 */
export async function createBookingCheckoutSession(input: CheckoutSessionInput): Promise<{
  checkoutUrl: string;
  externalId?: string;
}> {
  if (input.provider === "none") {
    throw new Error("Online payments are disabled (payment provider is none)");
  }

  if (input.provider === "stripe") {
    if (!hasStripe()) {
      throw new Error("Stripe is selected but STRIPE_SECRET_KEY is not set");
    }

    const label =
      input.paymentMode === "deposit"
        ? `Booking deposit — ${input.serviceLabel}`
        : `Booking payment — ${input.serviceLabel}`;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: input.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: input.totalCents,
            product_data: {
              name: label.slice(0, 120),
              description: `${formatCad(input.baseCents)} + HST ${formatCad(input.taxCents)}`,
            },
          },
        },
      ],
      metadata: {
        appointmentId: input.appointmentId,
        categoryId: input.categoryId,
        serviceIds: input.serviceIds.join(","),
        addonIds: input.addonIds.join(","),
        paymentMode: input.paymentMode,
        paymentProvider: "stripe",
      },
      success_url: `${siteUrl()}/book-now/success?appointment=${input.appointmentId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/book-now/cancelled?appointment=${input.appointmentId}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { checkoutUrl: session.url, externalId: session.id };
  }

  throw new Error(`Unsupported payment provider: ${input.provider}`);
}
