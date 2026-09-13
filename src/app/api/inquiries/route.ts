import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, hasDatabase } from "@/lib/db";
import { emailInquiryAlert, emailInquiryReceived } from "@/lib/email/resend";
import { notifyAdmins } from "@/lib/notifications";

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

  const db = getPrisma();
  const inquiry = await db.inquiry.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      serviceInterest: parsed.data.serviceInterest || null,
      message: parsed.data.message,
    },
  });

  const payload = {
    db,
    inquiryId: inquiry.id,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    serviceInterest: inquiry.serviceInterest,
    message: inquiry.message,
  };

  await Promise.allSettled([
    emailInquiryReceived(payload),
    emailInquiryAlert(payload),
    notifyAdmins(db, {
      type: "inquiry_new",
      title: "New inquiry",
      body: `${inquiry.name}${inquiry.serviceInterest ? ` · ${inquiry.serviceInterest}` : ""}`,
      href: "/admin/inquiries",
      metadata: { inquiryId: inquiry.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
