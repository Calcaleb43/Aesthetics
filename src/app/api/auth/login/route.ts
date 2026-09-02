import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { getPrisma, hasDatabase } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const envEmail = process.env.ADMIN_EMAIL || "admin@aniekanvas.com";
  const envPassword = process.env.ADMIN_PASSWORD || "aniekanvas-admin";

  if (
    parsed.data.email.toLowerCase() === envEmail.toLowerCase() &&
    parsed.data.password === envPassword
  ) {
    await createSession({
      sub: "env-admin",
      email: envEmail,
      name: "Admin",
    });
    return NextResponse.json({ ok: true });
  }

  if (hasDatabase()) {
    const admin = await getPrisma().admin.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (admin && (await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
      await createSession({
        sub: admin.id,
        email: admin.email,
        name: admin.name,
      });
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
