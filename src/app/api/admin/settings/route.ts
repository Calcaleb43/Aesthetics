import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";

const windowSchema = z.object({ start: z.string(), end: z.string() });

const schema = z.object({
  siteName: z.string(),
  tagline: z.string(),
  subtitle: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  instagramUrl: z.string(),
  bookingUrl: z.string(),
  heroImage: z.string(),
  aboutImage: z.string(),
  galleryImages: z.array(z.string()),
  homeIntro: z.string(),
  whyHeadline: z.string(),
  whyBody: z.string(),
  values: z.array(z.object({ title: z.string(), body: z.string() })),
  meetAnie: z.string(),
  googleReviewsUrl: z.string().optional(),
  googlePlaceId: z.string().optional(),
  timezone: z.string().optional(),
  weeklyHours: z.record(z.string(), z.array(windowSchema)).optional(),
  slotIntervalMinutes: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  minLeadHours: z.number().int().min(0).optional(),
  maxAdvanceDays: z.number().int().positive().optional(),
  hstRateBps: z.number().int().min(0).optional(),
  bookingEnabled: z.boolean().optional(),
  paymentProvider: z.enum(["stripe", "none"]).optional(),
});

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data = {
    ...parsed.data,
    googleReviewsUrl: parsed.data.googleReviewsUrl || "",
    googlePlaceId: parsed.data.googlePlaceId?.trim() || "",
    timezone: parsed.data.timezone || "America/Toronto",
    weeklyHours: parsed.data.weeklyHours || {},
    slotIntervalMinutes: parsed.data.slotIntervalMinutes ?? 30,
    bufferMinutes: parsed.data.bufferMinutes ?? 15,
    minLeadHours: parsed.data.minLeadHours ?? 24,
    maxAdvanceDays: parsed.data.maxAdvanceDays ?? 60,
    hstRateBps: parsed.data.hstRateBps ?? 1300,
    bookingEnabled: parsed.data.bookingEnabled ?? true,
    paymentProvider: parsed.data.paymentProvider ?? "stripe",
  };

  await gate.db.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}
