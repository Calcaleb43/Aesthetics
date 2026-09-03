import { AdminShell } from "@/components/admin/AdminShell";
import AdminMediaClient from "./MediaClient";

export default function AdminMediaPage() {
  return (
    <AdminShell
      title="Media Library"
      description="Store image URLs for covers, heroes, and galleries. Copy a URL into any content field."
    >
      <AdminMediaClient />
    </AdminShell>
  );
}
