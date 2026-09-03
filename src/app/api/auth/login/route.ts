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

  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 500 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  // Env credentials are for local bootstrap only — production uses the admins table.
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  const allowEnvLogin = process.env.NODE_ENV !== "production";

  if (allowEnvLogin && envEmail && envPassword && email === envEmail && password === envPassword) {
    await createSession({
      sub: "env-admin",
      email: envEmail,
      name: "Admin",
    });
    return NextResponse.json({ ok: true });
  }

  if (hasDatabase()) {
    try {
      const admin = await getPrisma().admin.findUnique({
        where: { email },
      });
      if (admin && (await bcrypt.compare(password, admin.passwordHash))) {
        await createSession({
          sub: admin.id,
          email: admin.email,
          name: admin.name,
        });
        return NextResponse.json({ ok: true });
      }
    } catch (err) {
      console.error("Admin login database error", err);
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
