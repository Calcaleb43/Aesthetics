import { AdminShell } from "@/components/admin/AdminShell";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { getSettings } from "@/lib/content/queries";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <AdminShell title="Site Settings">
      <AdminEditor
        endpoint="/api/admin/settings"
        initial={settings}
        fields={[
          { name: "siteName", label: "Site name" },
          { name: "tagline", label: "Tagline" },
          { name: "subtitle", label: "Subtitle" },
          { name: "email", label: "Email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address", type: "textarea", rows: 3 },
          { name: "instagramUrl", label: "Instagram URL" },
          { name: "bookingUrl", label: "Booking URL" },
          { name: "heroImage", label: "Hero image URL" },
          { name: "aboutImage", label: "About image URL" },
          { name: "galleryImages", label: "Gallery images (JSON array)", type: "json" },
          { name: "homeIntro", label: "Home intro", type: "textarea", rows: 5 },
          { name: "whyHeadline", label: "Why headline" },
          { name: "whyBody", label: "Why body", type: "textarea", rows: 4 },
          { name: "values", label: "Values (JSON array)", type: "json" },
          { name: "meetAnie", label: "Meet Anie", type: "textarea", rows: 8 },
        ]}
      />
    </AdminShell>
  );
}
