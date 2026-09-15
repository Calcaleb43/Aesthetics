import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AvailabilityClient } from "@/components/admin/AvailabilityClient";
import {
  canManageAllAppointments,
  canViewCalendar,
  canWriteAppointments,
} from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export default async function AdminAvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canViewCalendar(session.role)) redirect("/admin");

  return (
    <AdminShell
      title="Availability"
      description="Studio hours, staff schedules, day edits, blocked times, and booking slot rules — everything that shapes online booking."
    >
      <AvailabilityClient
        canWrite={canWriteAppointments(session.role)}
        canManageAll={canManageAllAppointments(session.role)}
      />
    </AdminShell>
  );
}
