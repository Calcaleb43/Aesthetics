import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const rows = await gate.db.inquiry.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}
