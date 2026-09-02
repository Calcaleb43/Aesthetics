import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAllCare, getAllFaqs, getAllPages, getPublishedServices } from "@/lib/content/queries";
import { hasDatabase } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [pages, services, faqs, care] = await Promise.all([
    getAllPages(),
    getPublishedServices(),
    getAllFaqs(),
    getAllCare(),
  ]);

  const cards = [
    { label: "Pages", count: pages.length, href: "/admin/pages" },
    { label: "Services", count: services.length, href: "/admin/services" },
    { label: "FAQ sets", count: faqs.length, href: "/admin/faqs" },
    { label: "Care guides", count: care.length, href: "/admin/care" },
  ];

  return (
    <AdminShell title="Dashboard">
      <p className="mb-6 text-sm text-white/60">
        Content source: {hasDatabase() ? "Neon Postgres" : "Bundled seed (connect Neon for live CMS writes)"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-white/50">{card.label}</p>
            <p className="mt-3 text-4xl">{card.count}</p>
          </Link>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl">Advanced CMS capabilities</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          <li>Draft / publish workflow for pages, services, FAQs, and care guides</li>
          <li>Site-wide settings (branding, contact, booking URL, gallery, homepage copy)</li>
          <li>FAQ item editor with structured Q&A JSON</li>
          <li>Media library for image URL management</li>
          <li>Consultation inquiry inbox stored in Neon</li>
        </ul>
      </div>
    </AdminShell>
  );
}
