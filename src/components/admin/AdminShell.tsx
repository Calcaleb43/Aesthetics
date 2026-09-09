import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSession } from "@/lib/auth/session";
import { getInquiryStats } from "@/lib/content/queries";
import { hasDatabase } from "@/lib/db";

export async function AdminShell({
  children,
  title,
  description,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const stats = await getInquiryStats();
  const dbReady = hasDatabase();

  return (
    <div className="min-h-screen">
      <AdminHeader
        email={session.email}
        role={session.role}
        hasDatabase={dbReady}
        inquiryUnread={stats.unread}
      />

      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-4 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-white/10 lg:px-4 lg:py-6">
          <AdminNav inquiryUnread={stats.unread} role={session.role} email={session.email} />
        </aside>

        <section className="p-6 lg:p-10">
          <div className="admin-page-header mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#c6a75e]">CMS</p>
              <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>
              {description ? <p className="mt-2 max-w-2xl text-sm text-white/55">{description}</p> : null}
            </div>
            {actions}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
