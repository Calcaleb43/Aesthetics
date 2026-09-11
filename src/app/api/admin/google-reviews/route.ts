import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdminApi } from "@/lib/auth/admin-api";
import {
  fetchGooglePlaceReviewsFresh,
  getGooglePlaceReviews,
  hasGooglePlacesConfig,
} from "@/lib/google/places-reviews";

export async function GET() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const settings = await gate.db.siteSettings.findUnique({ where: { id: 1 } });
  const placeId = settings?.googlePlaceId || "";
  const keyConfigured = Boolean(
    process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim(),
  );

  if (!hasGooglePlacesConfig(placeId)) {
    return NextResponse.json({
      configured: false,
      keyConfigured,
      placeIdConfigured: Boolean(placeId.trim()),
      placeId,
      reviews: [],
      message: !keyConfigured
        ? "Add GOOGLE_PLACES_API_KEY to the environment"
        : "Set Google Place ID in Settings",
    });
  }

  const data = await getGooglePlaceReviews(placeId);
  if (!data) {
    return NextResponse.json(
      {
        configured: true,
        keyConfigured,
        placeIdConfigured: true,
        placeId,
        error: "Could not load reviews from Google Places. Check Place ID and API key permissions.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    configured: true,
    keyConfigured,
    placeIdConfigured: true,
    ...data,
  });
}

export async function POST() {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const settings = await gate.db.siteSettings.findUnique({ where: { id: 1 } });
  const placeId = settings?.googlePlaceId || "";
  if (!hasGooglePlacesConfig(placeId)) {
    return NextResponse.json({ error: "Google Places is not configured" }, { status: 400 });
  }

  const data = await fetchGooglePlaceReviewsFresh(placeId);
  revalidateTag("google-reviews", "max");

  if (!data) {
    return NextResponse.json({ error: "Google Places request failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, configured: true, ...data });
}
