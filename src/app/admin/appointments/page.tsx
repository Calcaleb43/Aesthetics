import { AdminShell } from "@/components/admin/AdminShell";
import { AppointmentsClient } from "@/components/admin/AppointmentsClient";
import { BlockedTimesClient } from "@/components/admin/BlockedTimesClient";

export default function AdminAppointmentsPage() {
  return (
    <AdminShell
      title="Appointments"
      description="Confirmed bookings, payment holds, and studio blocked times."
    >
      <AppointmentsClient />
      <BlockedTimesClient />
    </AdminShell>
  );
}
