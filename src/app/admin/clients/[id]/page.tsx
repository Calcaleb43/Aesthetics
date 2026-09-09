import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientsDetailClient } from "@/components/admin/ClientsDetailClient";
import { canManageClients } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { getPrisma, hasDatabase } from "@/lib/db";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canManageClients(session.role)) redirect("/admin");

  const { id } = await params;
  if (!hasDatabase()) {
    return (
      <AdminShell title="Client" description="Database required.">
        <p className="text-sm text-white/50">Connect DATABASE_URL to view clients.</p>
      </AdminShell>
    );
  }

  const client = await getPrisma().client.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!client) notFound();

  return (
    <AdminShell title={client.name} description="Client profile, notes, and visit history.">
      <ClientsDetailClient clientId={client.id} />
    </AdminShell>
  );
}
