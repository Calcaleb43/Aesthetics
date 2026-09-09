import Link from "next/link";
import { NotificationBell } from "@/components/admin/NotificationBell";
import type { AdminRole } from "@/lib/auth/roles";

export function AdminHeader({
  email,
  role,
  hasDatabase,
  inquiryUnread = 0,
}: {
  email: string;
  role: AdminRole;
  hasDatabase: boolean;
  inquiryUnread?: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0f0f]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-3.5 lg:px-8">
        <div className="min-w-0 flex-1">
          <Link href="/admin" className="group inline-flex min-w-0 flex-col">
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[#c6a75e]">Aniekanvas</span>
            <span className="truncate text-sm font-semibold tracking-[0.08em] text-white transition group-hover:text-[#c6a75e]">
              Content Management
            </span>
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] ${
              hasDatabase
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${hasDatabase ? "bg-emerald-400" : "bg-amber-300"}`}
              aria-hidden
            />
            {hasDatabase ? "Neon connected" : "Seed mode"}
          </span>

          {inquiryUnread > 0 ? (
            <Link
              href="/admin/inquiries"
              className="rounded-full border border-[#c6a75e]/35 bg-[#c6a75e]/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-[#c6a75e] transition hover:bg-[#c6a75e]/25"
            >
              {inquiryUnread} new inquir{inquiryUnread === 1 ? "y" : "ies"}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/65 transition hover:border-white/30 hover:text-white sm:inline-flex"
          >
            View site
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-white/35">Signed in</p>
            <p className="max-w-[180px] truncate text-xs text-white/75">{email}</p>
            <p className="text-[0.6rem] uppercase tracking-[0.12em] text-[#c6a75e]">{role}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/65 transition hover:border-red-300/40 hover:text-red-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {!hasDatabase ? (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-2 text-center text-xs text-amber-100 lg:px-8">
          DATABASE_URL is missing — the public site uses seed content. Connect Neon to enable CMS writes.
        </div>
      ) : null}
    </header>
  );
}
