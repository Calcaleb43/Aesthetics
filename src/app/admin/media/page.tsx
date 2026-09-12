import { AdminShell } from "@/components/admin/AdminShell";
import AdminMediaClient from "./MediaClient";

export default function AdminMediaPage() {
  return (
    <AdminShell
      title="Media Library"
      description="Upload images or paste hosted URLs. Use the picker from content fields, or copy a URL manually."
    >
      <AdminMediaClient />
    </AdminShell>
  );
}
