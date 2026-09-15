import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { RevenueClient } from "@/components/admin/RevenueClient";
import { canManageCms } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export default async function AdminRevenuePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canManageCms(session.role)) redirect("/admin");

  return (
    <AdminShell
      title="Revenue & accounting"
      description="Collected payments, expenses, profit, tax, outstanding balances, package sales, ledger export, and manual adjustments."
    >
      <RevenueClient />
    </AdminShell>
  );
}
