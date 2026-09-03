import { AdminShell } from "@/components/admin/AdminShell";
import { getAllPages, getAdminCare, getAdminFaqs, getAdminServices, getInquiryStats } from "@/lib/content/queries";
import { hasDatabase } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [pages, services, faqs, care, inquiries] = await Promise.all([
    getAllPages(),
    getAdminServices(),
    getAdminFaqs(),
    getAdminCare(),
    getInquiryStats(),
  ]);

  const draftServices = services.filter((s) => s.status !== "published").length;
  const cards = [
    { label: "Pages", count: pages.length, meta: `${pages.filter((p) => p.status === "published").length} live`, href: "/admin/pages" },
    { label: "Services", count: services.length, meta: draftServices ? `${draftServices} draft` : "All published", href: "/admin/services" },
    { label: "FAQ sets", count: faqs.length, meta: `${faqs.filter((f) => f.status === "published").length} live`, href: "/admin/faqs" },
    { label: "Care guides", count: care.length, meta: `${care.filter((c) => c.status === "published").length} live`, href: "/admin/care" },
    { label: "Inquiries", count: inquiries.total, meta: inquiries.unread ? `${inquiries.unread} new` : "All reviewed", href: "/admin/inquiries" },
  ];

  return (
    <AdminShell
      title="Dashboard"
      description="Manage studio content, media, and consultation inquiries."
      actions={
        <Link href="/admin/settings" className="admin-btn">
          Site settings
        </Link>
      }
    >
      <p className="mb-6 text-sm text-white/55">
        Content source:{" "}
        <span className="text-white/80">{hasDatabase() ? "Neon Postgres" : "Bundled seed (read-only until Neon is connected)"}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="admin-card block p-5 transition hover:bg-white/10">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/45">{card.label}</p>
            <p className="mt-3 text-4xl tracking-tight">{card.count}</p>
            <p className="mt-2 text-xs text-white/45">{card.meta}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl">Recent inquiries</h2>
            <Link href="/admin/inquiries" className="text-xs uppercase tracking-[0.14em] text-[#c6a75e]">
              View all
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {inquiries.recent.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{row.name}</p>
                  <span className={`text-[0.65rem] uppercase tracking-[0.12em] ${row.status === "new" ? "text-[#c6a75e]" : "text-white/40"}`}>
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/55">{row.email}</p>
                <p className="mt-2 line-clamp-2 text-sm text-white/70">{row.message}</p>
              </div>
            ))}
            {!inquiries.recent.length && (
              <p className="text-sm text-white/45">No inquiries yet. Submissions from /contact will appear here.</p>
            )}
          </div>
        </div>

        <div className="admin-card p-6">
          <h2 className="text-xl">Quick links</h2>
          <div className="mt-5 grid gap-2 text-sm">
            {[
              { href: "/admin/settings", label: "Edit homepage & branding" },
              { href: "/admin/appointments", label: "Appointments & blocks" },
              { href: "/admin/services", label: "Manage services & pricing" },
              { href: "/admin/media", label: "Media library" },
              { href: "/book-now", label: "Open public booking" },
              { href: "/", label: "Open live site" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-white/10 px-4 py-3 text-white/75 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
