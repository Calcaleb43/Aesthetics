import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReportsClient } from "@/components/admin/ReportsClient";
import { canManageCms } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canManageCms(session.role)) redirect("/admin");

  return (
    <AdminShell
      title="Reports"
      description="Studio-wide analytics across appointments, clients, revenue, marketing, inquiries, team, email, and catalog."
    >
      <ReportsClient />
    </AdminShell>
  );
}
