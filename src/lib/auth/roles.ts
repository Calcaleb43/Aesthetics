export type AdminRole = "owner" | "manager" | "staff" | "viewer";

export const ADMIN_ROLES: AdminRole[] = ["owner", "manager", "staff", "viewer"];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

/** CMS content + settings edits */
export function canManageCms(role: AdminRole) {
  return role === "owner" || role === "manager";
}

/** Create/update/cancel any appointment or studio-wide blocks */
export function canManageAllAppointments(role: AdminRole) {
  return role === "owner" || role === "manager";
}

/** See calendar (own or all depending on role) */
export function canViewCalendar(role: AdminRole) {
  return true;
}

export function canWriteAppointments(role: AdminRole) {
  return role === "owner" || role === "manager" || role === "staff";
}

/** Team / roles admin */
export function canManageTeam(role: AdminRole) {
  return role === "owner";
}

export function canViewInquiries(role: AdminRole) {
  return role === "owner" || role === "manager" || role === "viewer";
}

export function canManageInquiries(role: AdminRole) {
  return role === "owner" || role === "manager";
}

/** Client CRM list */
export function canManageClients(role: AdminRole) {
  return role === "owner" || role === "manager";
}

export function navVisible(role: AdminRole, href: string) {
  if (href === "/admin" || href.startsWith("/admin?")) return true;
  if (href.startsWith("/admin/team")) return canManageTeam(role);
  if (href.startsWith("/admin/clients")) return canManageClients(role);
  if (href.startsWith("/admin/appointments")) return canViewCalendar(role);
  if (href.startsWith("/admin/inquiries")) return canViewInquiries(role);
  if (role === "staff" || role === "viewer") return false;
  if (
    href.startsWith("/admin/settings") ||
    href.startsWith("/admin/pages") ||
    href.startsWith("/admin/media") ||
    href.startsWith("/admin/services") ||
    href.startsWith("/admin/addons") ||
    href.startsWith("/admin/categories") ||
    href.startsWith("/admin/faqs") ||
    href.startsWith("/admin/care") ||
    href.startsWith("/admin/testimonials")
  ) {
    return canManageCms(role);
  }
  return canManageCms(role);
}
