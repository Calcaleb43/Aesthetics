import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPrisma, hasDatabase } from "@/lib/db";

export async function requireAdminApi() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
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
