import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripe) {
    stripe = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return stripe;
}

export function hasStripe() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
