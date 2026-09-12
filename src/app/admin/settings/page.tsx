import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { paymentEnvStatus, paymentProviderConfigured, paymentProviderLabel } from "@/lib/booking/payments";
import { getSettings } from "@/lib/content/queries";
import type { PaymentProvider } from "@/lib/content/seed";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const envStatus = paymentEnvStatus();
  const provider = settings.paymentProvider as PaymentProvider;
  const ready = paymentProviderConfigured(provider);

  return (
    <AdminShell
      title="Site Settings"
      description="Global branding, contact details, booking link, and homepage copy."
    >
      <div className="admin-card mb-6 p-5">
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/40">Payments</p>
        <p className="mt-2 text-sm text-white/80">
          Active platform: <strong className="text-white">{paymentProviderLabel(provider)}</strong>
          {" · "}
          <span className={ready ? "text-emerald-300" : "text-amber-200"}>
            {ready ? "Env credentials ready" : "Env credentials missing"}
          </span>
        </p>
        <p className="mt-2 text-xs text-white/45">
          Choose the platform below. API keys stay in server env — never stored in the CMS.
          Stripe needs <code className="text-white/70">STRIPE_SECRET_KEY</code>
          {envStatus.stripe.secretKey ? " ✓" : " ✗"},{" "}
          <code className="text-white/70">STRIPE_WEBHOOK_SECRET</code>
          {envStatus.stripe.webhookSecret ? " ✓" : " ✗"},{" "}
          <code className="text-white/70">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
          {envStatus.stripe.publishableKey ? " ✓" : " ✗"}.
        </p>
      </div>

      <div className="admin-card p-6 md:p-8">
        <AdminEditor
          identityKey="settings"
          endpoint="/api/admin/settings"
          initial={settings as unknown as Record<string, unknown>}
          fields={[
            { name: "siteName", label: "Site name" },
            { name: "tagline", label: "Tagline" },
            { name: "subtitle", label: "Subtitle" },
            { name: "email", label: "Email" },
            { name: "phone", label: "Phone" },
            { name: "address", label: "Address", type: "textarea", rows: 3 },
            { name: "instagramUrl", label: "Instagram URL" },
            { name: "bookingUrl", label: "External booking URL (fallback)" },
            {
              name: "googleReviewsUrl",
              label: "Google reviews URL",
              hint: "Public Maps / Business Profile link for “See all reviews”",
            },
            {
              name: "googlePlaceId",
              label: "Google Place ID",
              hint: "From Google Maps / Place ID finder. Requires GOOGLE_PLACES_API_KEY in env.",
            },
            { name: "bookingEnabled", label: "Native online booking enabled", type: "boolean" },
            {
              name: "paymentProvider",
              label: "Booking payment platform",
              type: "select",
              options: ["stripe", "none"],
              hint: "Secrets stay in env. stripe = Stripe Checkout; none = confirm bookings with no online charge.",
            },
            { name: "timezone", label: "Timezone", hint: "e.g. America/Toronto" },
            {
              name: "weeklyHours",
              label: "Weekly hours (JSON)",
              type: "json",
              rows: 10,
              hint: 'Keys: mon–sun. Example: {"mon":[{"start":"10:00","end":"18:00"}]}',
            },
            { name: "slotIntervalMinutes", label: "Slot interval (minutes)", type: "number" },
            { name: "bufferMinutes", label: "Buffer between appointments (minutes)", type: "number" },
            { name: "minLeadHours", label: "Minimum lead time (hours)", type: "number" },
            { name: "maxAdvanceDays", label: "Max days ahead to book", type: "number" },
            { name: "hstRateBps", label: "HST rate (basis points)", type: "number", hint: "1300 = 13%" },
            { name: "heroImage", label: "Hero image", type: "media", hint: "Choose from Media Library" },
            { name: "aboutImage", label: "About image", type: "media", hint: "Choose from Media Library" },
            {
              name: "galleryImages",
              label: "Gallery images",
              type: "media-list",
              hint: "Pick from Media Library (or edit URLs under Advanced)",
              rows: 8,
            },
            { name: "homeIntro", label: "Home intro", type: "textarea", rows: 5 },
            { name: "whyHeadline", label: "Why headline" },
            { name: "whyBody", label: "Why body", type: "textarea", rows: 4 },
            { name: "values", label: "Studio values", type: "value-list" },
            { name: "meetAnie", label: "Meet Anie", type: "textarea", rows: 8 },
          ]}
        />
      </div>
    </AdminShell>
  );
}
