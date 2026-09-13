import { AdminShell } from "@/components/admin/AdminShell";
import { EmailHubClient } from "@/components/admin/EmailHubClient";

export default function AdminEmailPage() {
  return (
    <AdminShell
      title="Email"
      description="Compose to a client, bulk campaigns, custom templates, transactional previews, and delivery log."
    >
      <EmailHubClient />
    </AdminShell>
  );
}
