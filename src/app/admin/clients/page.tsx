import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientsClient } from "@/components/admin/ClientsClient";
import { canManageClients } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export default async function AdminClientsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canManageClients(session.role)) redirect("/admin");

  return (
    <AdminShell title="Clients" description="Client records, history, and quick booking.">
      <ClientsClient />
    </AdminShell>
  );
}
