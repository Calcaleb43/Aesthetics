import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { TeamClient } from "@/components/admin/TeamClient";
import { canManageTeam } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { getAdminBookableServices } from "@/lib/content/queries";

export default async function AdminTeamPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canManageTeam(session.role)) redirect("/admin");

  const services = await getAdminBookableServices();
  const serviceOptions = services
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id as string,
      title: s.categorySlug ? `${s.title} (${s.categorySlug})` : s.title,
      slug: s.slug,
    }));

  return (
    <AdminShell title="Team" description="Manage staff accounts, roles, and service assignments.">
      <TeamClient services={serviceOptions} />
    </AdminShell>
  );
}
