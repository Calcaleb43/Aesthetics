import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, hasDatabase } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  serviceInterest: z.string().optional(),
  message: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (!hasDatabase()) {
    console.log("[inquiry:demo]", parsed.data);
    return NextResponse.json({ ok: true, demo: true });
  }

  await getPrisma().inquiry.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      serviceInterest: parsed.data.serviceInterest || null,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ ok: true });
}
