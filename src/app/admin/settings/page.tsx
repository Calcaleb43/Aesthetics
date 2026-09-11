import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getSettings } from "@/lib/content/queries";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <AdminShell
      title="Site Settings"
      description="Global branding, contact details, booking link, and homepage copy."
    >
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
            { name: "heroImage", label: "Hero image URL" },
            { name: "aboutImage", label: "About image URL" },
            {
              name: "galleryImages",
              label: "Gallery images",
              type: "url-list",
              hint: "One URL per line",
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
