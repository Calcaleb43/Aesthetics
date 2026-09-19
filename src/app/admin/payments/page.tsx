import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PendingPaymentsClient } from "@/components/admin/PendingPaymentsClient";
import { canViewCalendar } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export default async function AdminPaymentsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canViewCalendar(session.role)) redirect("/admin");

  return (
    <AdminShell
      title="Pending payments"
      description="Balances owed on deposit and pay-at-studio bookings. Receive payment by Stripe, cash, e-transfer, or card at studio."
    >
      <PendingPaymentsClient />
    </AdminShell>
  );
}
