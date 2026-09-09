import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminCalendar } from "@/components/admin/calendar/AdminCalendar";
import { getAdminServices, getSettings } from "@/lib/content/queries";

export default async function AdminAppointmentsPage() {
  const [services, settings] = await Promise.all([getAdminServices(), getSettings()]);
  const initialServices = services
    .filter((s) => s.id)
    .map((s) => ({ id: s.id as string, title: s.title, slug: s.slug }));

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
