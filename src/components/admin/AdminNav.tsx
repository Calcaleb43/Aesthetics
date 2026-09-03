"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/faqs", label: "FAQs" },
  { href: "/admin/care", label: "Care Guides" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminNav({ inquiryUnread = 0 }: { inquiryUnread?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {links.map((link) => {
        const active = "exact" in link && link.exact ? pathname === link.href : pathname.startsWith(link.href);
        const showBadge = link.href === "/admin/inquiries" && inquiryUnread > 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition ${
              active ? "admin-nav-link-active" : "admin-nav-link"
            }`}
          >
            <span>{link.label}</span>
            {showBadge ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                  active ? "bg-[#0f0f0f] text-[#f5f1eb]" : "bg-[#c6a75e] text-[#0f0f0f]"
                }`}
              >
                {inquiryUnread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
