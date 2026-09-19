import type Stripe from "stripe";
import { formatCad } from "@/lib/booking/money";
import { getStripe, hasStripe, siteUrl } from "@/lib/booking/stripe";

export const PAYMENT_PROVIDERS = ["stripe", "none"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Hosted Checkout methods: card + Afterpay/Clearpay (CAD). Enable Afterpay in Stripe Dashboard too. */
export const STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
  ["card", "afterpay_clearpay"];

/** Shared options so Afterpay/Clearpay appears on Stripe Checkout (needs address for BNPL eligibility). */
export function stripeCheckoutBnplOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  | "payment_method_types"
  | "billing_address_collection"
  | "phone_number_collection"
  | "shipping_address_collection"
> {
  return {
    payment_method_types: [...STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES],
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    // Afterpay/Clearpay requires a shipping address even for services
    shipping_address_collection: {
      allowed_countries: ["CA", "US"],
    },
  };
}

/** Card-only fallback when Afterpay is not activated on the Stripe account. */
export function stripeCheckoutCardOnlyOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "payment_method_types" | "billing_address_collection"
> {
  return {
    payment_method_types: ["card"],
    billing_address_collection: "required",
  };
}

function isAfterpayUnavailableError(err: unknown) {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message || "")
      : String(err || "");
  const lower = message.toLowerCase();
  return (
    lower.includes("afterpay") ||
    lower.includes("clearpay") ||
    lower.includes("payment_method_types") ||
    lower.includes("payment method type")
  );
}

/** Create a Checkout session with Afterpay when available; fall back to card-only. */
export async function createStripeCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  try {
    return await stripe.checkout.sessions.create({
      ...params,
      ...stripeCheckoutBnplOptions(),
    });
  } catch (err) {
    if (!isAfterpayUnavailableError(err)) throw err;
    console.warn(
      "[stripe] Afterpay unavailable on this account; falling back to card-only checkout",
      err instanceof Error ? err.message : err,
    );
    return stripe.checkout.sessions.create({
      ...params,
      ...stripeCheckoutCardOnlyOptions(),
    });
  }
}

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

    const session = await createStripeCheckoutSession({
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
        purpose: "booking",
      },
      success_url: `${siteUrl()}/book-now/success?appointment=${input.appointmentId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/book-now/cancelled?appointment=${input.appointmentId}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { checkoutUrl: session.url, externalId: session.id };
  }

  throw new Error(`Unsupported payment provider: ${input.provider}`);
}

/** Stripe Checkout for remaining balance after a deposit. */
export async function createBalanceCheckoutSession(input: {
  appointmentId: string;
  clientEmail: string;
  serviceLabel: string;
  balanceDueCents: number;
}): Promise<{ checkoutUrl: string; externalId: string }> {
  if (!hasStripe()) {
    throw new Error("Stripe is not configured");
  }
  if (input.balanceDueCents <= 0) {
    throw new Error("No balance due");
  }

  const session = await createStripeCheckoutSession({
    mode: "payment",
    customer_email: input.clientEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: input.balanceDueCents,
          product_data: {
            name: `Remaining balance — ${input.serviceLabel}`.slice(0, 120),
            description: "Balance due after deposit (incl. HST)",
          },
        },
      },
    ],
    metadata: {
      appointmentId: input.appointmentId,
      paymentProvider: "stripe",
      purpose: "balance",
      balanceDueCents: String(input.balanceDueCents),
    },
    success_url: `${siteUrl()}/book-now/success?appointment=${input.appointmentId}&balance=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/book-now/manage`,
  });

  if (!session.url || !session.id) throw new Error("Stripe did not return a checkout URL");
  return { checkoutUrl: session.url, externalId: session.id };
}
