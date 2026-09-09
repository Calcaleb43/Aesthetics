import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import {
  canManageAllAppointments,
  canManageClients,
  canManageCms,
  canManageInquiries,
  canManageTeam,
  canViewCalendar,
  canWriteAppointments,
  type AdminRole,
} from "@/lib/auth/roles";
import { getPrisma, hasDatabase, type Database } from "@/lib/db";

export type AdminGate =
  | { error: NextResponse }
  | { db: Database; session: SessionPayload };

type GateOptions = {
  roles?: AdminRole[];
  /** Named capability checks */
  permission?:
    | "cms"
    | "team"
    | "calendar"
    | "appointments_write"
    | "appointments_all"
    | "inquiries"
    | "clients";
};

function allowed(session: SessionPayload, options?: GateOptions) {
  if (options?.roles?.length && !options.roles.includes(session.role)) return false;
  switch (options?.permission) {
    case "cms":
      return canManageCms(session.role);
    case "team":
      return canManageTeam(session.role);
    case "calendar":
      return canViewCalendar(session.role);
    case "appointments_write":
      return canWriteAppointments(session.role);
    case "appointments_all":
      return canManageAllAppointments(session.role);
    case "inquiries":
      return canManageInquiries(session.role);
    case "clients":
      return canManageClients(session.role);
    default:
      return true;
  }
}

export async function requireAdminApi(options?: GateOptions): Promise<AdminGate> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!allowed(session, options)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!hasDatabase()) {
    return {
      error: NextResponse.json(
        { error: "DATABASE_URL is required for CMS writes" },
        { status: 503 },
      ),
    };
  }
  return { db: getPrisma(), session };
}
