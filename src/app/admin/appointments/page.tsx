import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminCalendar } from "@/components/admin/calendar/AdminCalendar";
import { getAdminBookableServices, getAdminCategories, getSettings } from "@/lib/content/queries";

export default async function AdminAppointmentsPage() {
  const [services, settings] = await Promise.all([getAdminBookableServices(), getSettings()]);
  const categories = await getAdminCategories();
  const titleBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.title]));
  const initialServices = services
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id as string,
      title: s.title,
      slug: s.slug,
      categorySlug: s.categorySlug,
      categoryTitle: titleBySlug[s.categorySlug] || s.categorySlug,
    }));

  return (
    <AdminShell
      title="Appointments"
      description="Calendar, bookings, and studio blocked times."
    >
      <Suspense fallback={<p className="text-sm text-white/50">Loading calendar…</p>}>
        <AdminCalendar initialServices={initialServices} timezone={settings.timezone} />
      </Suspense>
    </AdminShell>
  );
}
