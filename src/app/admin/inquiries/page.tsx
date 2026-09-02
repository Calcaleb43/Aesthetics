import { AdminShell } from "@/components/admin/AdminShell";
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
    <AdminShell title="Inquiries">
      {!hasDatabase() && (
        <p className="mb-6 text-sm text-amber-200">
          Connect Neon to persist and view consultation inquiries from the contact form.
        </p>
      )}
      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">{row.name}</h2>
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-2 text-sm text-white/70">
              {row.email}
              {row.phone ? ` · ${row.phone}` : ""}
            </p>
            {row.serviceInterest && (
              <p className="mt-1 text-sm text-white/60">Interest: {row.serviceInterest}</p>
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/80">{row.message}</p>
          </article>
        ))}
        {!rows.length && <p className="text-sm text-white/50">No inquiries yet.</p>}
      </div>
    </AdminShell>
  );
}
