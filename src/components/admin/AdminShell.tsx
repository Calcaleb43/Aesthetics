import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasDatabase } from "@/lib/db";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/faqs", label: "FAQs" },
  { href: "/admin/care", label: "Care Guides" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/settings", label: "Site Settings" },
];

export async function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="mx-auto grid min-h-screen max-w-[1400px] lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Aniekanvas CMS</p>
        <p className="mt-2 text-sm text-white/70">{session.email}</p>
        {!hasDatabase() && (
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            DATABASE_URL missing — public site uses seed content. Connect Neon to enable writes.
          </p>
        )}
        <nav className="mt-8 flex flex-col gap-2 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded px-3 py-2 hover:bg-white/5">
              {link.label}
            </Link>
          ))}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="mt-4 w-full rounded px-3 py-2 text-left text-white/60 hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <section className="p-6 lg:p-10">
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <div className="mt-8">{children}</div>
      </section>
    </div>
  );
}
