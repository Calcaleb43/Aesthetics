"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  FileText,
  FolderTree,
  HelpCircle,
  ImageIcon,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Star,
  Users,
  UserRound,
  X,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { navVisible, type AdminRole } from "@/lib/auth/roles";
import { SiteLogo } from "@/components/site/SiteLogo";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  links: NavLink[];
};

const groups: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/admin/clients", label: "Clients", icon: UserRound },
      { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
    ],
  },
  {
    id: "content",
    label: "Content",
    links: [
      { href: "/admin/pages", label: "Pages", icon: FileText },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/services", label: "Services", icon: Sparkles },
      { href: "/admin/addons", label: "Add-ons", icon: PlusCircle },
      { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
      { href: "/admin/care", label: "Care Guides", icon: BookOpen },
      { href: "/admin/testimonials", label: "Testimonials", icon: Star },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    links: [
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, link: NavLink) {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function AdminNav({
  inquiryUnread = 0,
  role,
  email,
}: {
  inquiryUnread?: number;
  role: AdminRole;
  email?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => navVisible(role, link.href)),
    }))
    .filter((group) => group.links.length > 0);

  const navBody = (
    <>
      <div className="mb-6 hidden lg:block">
        <SiteLogo className="h-10 w-auto max-w-[10rem]" />
        <p className="mt-2 text-[0.62rem] uppercase tracking-[0.2em] text-[#c6a75e]">Studio CMS</p>
      </div>

      <nav className="flex flex-1 flex-col gap-6">
        {visibleGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-2 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/30">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active = isActive(pathname, link);
                const Icon = link.icon;
                const showBadge = link.href === "/admin/inquiries" && inquiryUnread > 0;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`admin-nav-item group ${active ? "admin-nav-item-active" : ""}`}
                    >
                      <span className="admin-nav-item-icon" aria-hidden>
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 truncate">{link.label}</span>
                      {showBadge ? (
                        <span className="admin-nav-badge">{inquiryUnread}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {email ? (
        <div className="mt-8 border-t border-white/10 pt-4">
          <p className="truncate px-3 text-xs text-white/55">{email}</p>
          <p className="mt-1 px-3 text-[0.62rem] uppercase tracking-[0.14em] text-[#c6a75e]">{role}</p>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-white/35">Menu</p>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/30 hover:text-white"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      <div className="mt-3 hidden lg:flex lg:h-full lg:flex-col">{navBody}</div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-[#121212] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[#c6a75e]">Aniekanvas</p>
                <p className="text-sm font-medium text-white">Navigation</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            {navBody}
          </aside>
        </div>
      ) : null}
    </>
  );
}
