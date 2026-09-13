import { AdminShell } from "@/components/admin/AdminShell";
import { EmailHubClient } from "@/components/admin/EmailHubClient";

export default function AdminEmailPage() {
  return (
    <AdminShell
      title="Email"
      description="Branded transactional templates, delivery log, and Resend test sends."
    >
      <EmailHubClient />
    </AdminShell>
  );
}
