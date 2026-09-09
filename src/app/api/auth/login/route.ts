import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { attachSessionCookie, signSession } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { getPrisma, hasDatabase } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "AUTH_SECRET is not configured on this server" },
      { status: 500 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  const allowEnvLogin = process.env.NODE_ENV !== "production";

  try {
    if (allowEnvLogin && envEmail && envPassword && email === envEmail && password === envPassword) {
      const token = await signSession({
        sub: "env-admin",
        email: envEmail,
        name: "Admin",
        role: "owner",
      });
      return attachSessionCookie(NextResponse.json({ ok: true }), token);
    }

    if (!hasDatabase()) {
      return NextResponse.json(
        { error: "Database is not connected on this server (set DATABASE_URL)" },
        { status: 503 },
      );
    }

    const admin = await getPrisma().admin.findUnique({
      where: { email },
    });
    if (admin && admin.active && (await bcrypt.compare(password, admin.passwordHash))) {
      const token = await signSession({
        sub: admin.id,
        email: admin.email,
        name: admin.name,
        role: isAdminRole(admin.role) ? admin.role : "viewer",
      });
      return attachSessionCookie(NextResponse.json({ ok: true }), token);
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (err) {
    console.error("Admin login error", err);
    const message = err instanceof Error ? err.message : "Login failed";
    if (message.includes("AUTH_SECRET")) {
      return NextResponse.json({ error: "AUTH_SECRET is not configured on this server" }, { status: 500 });
    }
    return NextResponse.json({ error: "Login failed — check server configuration" }, { status: 500 });
  }
}
