import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { revalidateSite } from "@/lib/admin/revalidate";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { getSeedSettings } from "@/lib/content/seed";

const windowSchema = z.object({ start: z.string(), end: z.string() });

/** Partial update — each settings sub-page saves only its own fields. */
const schema = z
  .object({
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
    googleReviewsUrl: z.string(),
    googlePlaceId: z.string(),
    timezone: z.string(),
    weeklyHours: z.record(z.string(), z.array(windowSchema)),
    slotIntervalMinutes: z.number().int().positive(),
    bufferMinutes: z.number().int().min(0),
    minLeadHours: z.number().int().min(0),
    maxAdvanceDays: z.number().int().positive(),
    hstRateBps: z.number().int().min(0),
    bookingEnabled: z.boolean(),
    paymentProvider: z.enum(["stripe", "none"]),
  })
  .partial();

export async function PUT(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Prisma.SiteSettingsUpdateInput = {};
  const body = parsed.data;

  if (body.siteName !== undefined) patch.siteName = body.siteName;
  if (body.tagline !== undefined) patch.tagline = body.tagline;
  if (body.subtitle !== undefined) patch.subtitle = body.subtitle;
  if (body.email !== undefined) patch.email = body.email;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.address !== undefined) patch.address = body.address;
  if (body.instagramUrl !== undefined) patch.instagramUrl = body.instagramUrl;
  if (body.bookingUrl !== undefined) patch.bookingUrl = body.bookingUrl;
  if (body.heroImage !== undefined) patch.heroImage = body.heroImage;
  if (body.aboutImage !== undefined) patch.aboutImage = body.aboutImage;
  if (body.galleryImages !== undefined) patch.galleryImages = body.galleryImages;
  if (body.homeIntro !== undefined) patch.homeIntro = body.homeIntro;
  if (body.whyHeadline !== undefined) patch.whyHeadline = body.whyHeadline;
  if (body.whyBody !== undefined) patch.whyBody = body.whyBody;
  if (body.values !== undefined) patch.values = body.values;
  if (body.meetAnie !== undefined) patch.meetAnie = body.meetAnie;
  if (body.googleReviewsUrl !== undefined) patch.googleReviewsUrl = body.googleReviewsUrl;
  if (body.googlePlaceId !== undefined) patch.googlePlaceId = body.googlePlaceId.trim();
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.weeklyHours !== undefined) patch.weeklyHours = body.weeklyHours;
  if (body.slotIntervalMinutes !== undefined) patch.slotIntervalMinutes = body.slotIntervalMinutes;
  if (body.bufferMinutes !== undefined) patch.bufferMinutes = body.bufferMinutes;
  if (body.minLeadHours !== undefined) patch.minLeadHours = body.minLeadHours;
  if (body.maxAdvanceDays !== undefined) patch.maxAdvanceDays = body.maxAdvanceDays;
  if (body.hstRateBps !== undefined) patch.hstRateBps = body.hstRateBps;
  if (body.bookingEnabled !== undefined) patch.bookingEnabled = body.bookingEnabled;
  if (body.paymentProvider !== undefined) patch.paymentProvider = body.paymentProvider;

  const seed = getSeedSettings();
  const createData: Prisma.SiteSettingsUncheckedCreateInput = {
    id: 1,
    siteName: seed.siteName,
    tagline: seed.tagline,
    subtitle: seed.subtitle,
    email: seed.email,
    phone: seed.phone,
    address: seed.address,
    instagramUrl: seed.instagramUrl,
    bookingUrl: seed.bookingUrl,
    heroImage: seed.heroImage,
    aboutImage: seed.aboutImage,
    galleryImages: seed.galleryImages,
    homeIntro: seed.homeIntro,
    whyHeadline: seed.whyHeadline,
    whyBody: seed.whyBody,
    values: seed.values,
    meetAnie: seed.meetAnie,
    googleReviewsUrl: seed.googleReviewsUrl,
    googlePlaceId: seed.googlePlaceId,
    timezone: seed.timezone,
    weeklyHours: seed.weeklyHours,
    slotIntervalMinutes: seed.slotIntervalMinutes,
    bufferMinutes: seed.bufferMinutes,
    minLeadHours: seed.minLeadHours,
    maxAdvanceDays: seed.maxAdvanceDays,
    hstRateBps: seed.hstRateBps,
    bookingEnabled: seed.bookingEnabled,
    paymentProvider: seed.paymentProvider,
    ...Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        key === "googlePlaceId" && typeof value === "string" ? value.trim() : value,
      ]),
    ),
  };

  await gate.db.siteSettings.upsert({
    where: { id: 1 },
    create: createData,
    update: patch,
  });

  revalidateSite();
  return NextResponse.json({ ok: true });
}
