import { AdminShell } from "@/components/admin/AdminShell";
import { InquiriesClient } from "@/components/admin/InquiriesClient";
import { getPrisma, hasDatabase } from "@/lib/db";

export default async function AdminInquiriesPage() {
  let rows: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    serviceInterest: string | null;
    message: string;
    status: string;
    createdAt: Date;
  }[] = [];

  if (hasDatabase()) {
    try {
      rows = await getPrisma().inquiry.findMany({ orderBy: { createdAt: "desc" } });
    } catch {
      rows = [];
    }
  }

  return (
    <AdminShell
      title="Inquiries"
      description="Consultation requests from the contact form."
    >
      {!hasDatabase() && (
        <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Connect Neon to persist and manage consultation inquiries.
        </p>
      )}
      <InquiriesClient
        initial={rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </AdminShell>
  );
}
