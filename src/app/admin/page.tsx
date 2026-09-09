import { AdminShell } from "@/components/admin/AdminShell";
import {
  getAdminCare,
  getAdminFaqs,
  getAdminServices,
  getAllPages,
  getAppointmentDashboard,
  getInquiryStats,
} from "@/lib/content/queries";
import { hasDatabase } from "@/lib/db";
import Link from "next/link";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function AdminDashboardPage() {
  const [pages, services, faqs, care, inquiries, appointments] = await Promise.all([
    getAllPages(),
    getAdminServices(),
    getAdminFaqs(),
    getAdminCare(),
    getInquiryStats(),
    getAppointmentDashboard(),
  ]);

  const draftServices = services.filter((s) => s.status !== "published").length;
  const cards = [
    {
      label: "Appointments",
      count: appointments.upcomingCount,
      meta: appointments.todayCount
        ? `${appointments.todayCount} today`
        : appointments.pendingPayment
          ? `${appointments.pendingPayment} awaiting payment`
          : "Next 14 days clear",
      href: "/admin/appointments",
    },
    {
      label: "Inquiries",
      count: inquiries.total,
      meta: inquiries.unread ? `${inquiries.unread} new` : "All reviewed",
      href: "/admin/inquiries",
    },
    {
      label: "Pages",
      count: pages.length,
      meta: `${pages.filter((p) => p.status === "published").length} live`,
      href: "/admin/pages",
    },
    {
      label: "Services",
      count: services.length,
      meta: draftServices ? `${draftServices} draft` : "All published",
      href: "/admin/services",
    },
    {
      label: "FAQ sets",
      count: faqs.length,
      meta: `${faqs.filter((f) => f.status === "published").length} live`,
      href: "/admin/faqs",
    },
    {
      label: "Care guides",
      count: care.length,
      meta: `${care.filter((c) => c.status === "published").length} live`,
      href: "/admin/care",
    },
  ];

  return (
    <AdminShell
      title="Dashboard"
      description="Studio schedule, inquiries, and content at a glance."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/appointments" className="admin-btn-secondary">
            Calendar
          </Link>
          <Link href="/admin/settings" className="admin-btn">
            Site settings
          </Link>
        </div>
      }
    >
      <p className="mb-6 text-sm text-white/55">
        Content source:{" "}
        <span className="text-white/80">
          {hasDatabase() ? "Neon Postgres" : "Bundled seed (read-only until Neon is connected)"}
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => (
          <Link
            key={card.href + card.label}
            href={card.href}
            className="admin-card block p-5 transition hover:bg-white/10"
          >
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/45">{card.label}</p>
            <p className="mt-3 text-4xl tracking-tight">{card.count}</p>
            <p className="mt-2 text-xs text-white/45">{card.meta}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <div className="admin-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl text-white">Upcoming appointments</h2>
              <p className="mt-1 text-sm text-white/45">Next two weeks · confirmed & pending payment</p>
            </div>
            <Link
              href="/admin/appointments"
              className="text-xs uppercase tracking-[0.14em] text-[#c6a75e] hover:underline"
            >
              Open calendar
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {appointments.upcoming.map((row) => (
              <Link
                key={row.id}
                href="/admin/appointments"
                className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.clientName}</p>
                    <p className="mt-1 text-sm text-white/60">{row.serviceTitle}</p>
                    <p className="mt-2 text-sm text-[#c6a75e]">{formatWhen(row.startsAt)}</p>
                    {row.staffName ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/35">
                        {row.staffName}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-white/45">
                    {row.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
            {!appointments.upcoming.length ? (
              <p className="text-sm text-white/45">
                No upcoming bookings in the next 14 days.{" "}
                <Link href="/admin/appointments" className="text-[#c6a75e] underline">
                  Add one on the calendar
                </Link>
                .
              </p>
            ) : null}
          </div>
        </div>

        <div className="admin-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl text-white">Recent inquiries</h2>
              <p className="mt-1 text-sm text-white/45">
                {inquiries.unread
                  ? `${inquiries.unread} unread of ${inquiries.total}`
                  : `${inquiries.total} total`}
              </p>
            </div>
            <Link
              href="/admin/inquiries"
              className="text-xs uppercase tracking-[0.14em] text-[#c6a75e] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {inquiries.recent.map((row) => (
              <Link
                key={row.id}
                href="/admin/inquiries"
                className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-white">{row.name}</p>
                  <span
                    className={`text-[0.65rem] uppercase tracking-[0.12em] ${
                      row.status === "new" ? "text-[#c6a75e]" : "text-white/40"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/55">{row.email}</p>
                {row.serviceInterest ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/35">
                    {row.serviceInterest}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm text-white/70">{row.message}</p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-white/30">
                  {formatDay(row.createdAt)}
                </p>
              </Link>
            ))}
            {!inquiries.recent.length ? (
              <p className="text-sm text-white/45">
                No inquiries yet. Submissions from{" "}
                <Link href="/contact" className="text-[#c6a75e] underline">
                  /contact
                </Link>{" "}
                will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-card mt-6 p-6">
        <h2 className="text-xl text-white">Quick links</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {[
            { href: "/admin/appointments", label: "Appointments & blocked times" },
            { href: "/admin/clients", label: "Client list" },
            { href: "/admin/inquiries", label: "Inquiry inbox" },
            { href: "/admin/settings", label: "Homepage & branding" },
            { href: "/admin/services", label: "Services & pricing" },
            { href: "/book-now", label: "Public booking" },
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
    </AdminShell>
  );
}
