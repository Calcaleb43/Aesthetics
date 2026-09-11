import { unstable_cache } from "next/cache";

export type GoogleReview = {
  id: string;
  quote: string;
  authorName: string;
  rating: number;
  authorUri: string | null;
  relativeTime: string | null;
  publishTime: string | null;
};

export type GooglePlaceReviews = {
  placeId: string;
  displayName: string | null;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  reviews: GoogleReview[];
  fetchedAt: string;
};

type PlacesReview = {
  name?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
};

type PlacesDetailsResponse = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesReview[];
  error?: { message?: string; status?: string };
};

function apiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function hasGooglePlacesConfig(placeId?: string | null) {
  return Boolean(apiKey() && placeId?.trim());
}

function normalizePlaceId(placeId: string) {
  const trimmed = placeId.trim();
  return trimmed.startsWith("places/") ? trimmed.slice("places/".length) : trimmed;
}

async function fetchPlaceReviewsUncached(placeId: string): Promise<GooglePlaceReviews | null> {
  const key = apiKey();
  if (!key) return null;

  const id = normalizePlaceId(placeId);
  if (!id) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "displayName,rating,userRatingCount,googleMapsUri,reviews",
    },
    // Avoid Next fetch cache fighting unstable_cache; we control TTL above.
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as PlacesDetailsResponse;
  if (!res.ok) {
    console.error("Google Places reviews error", res.status, data.error || data);
    return null;
  }

  const reviews: GoogleReview[] = (data.reviews || [])
    .map((r, index) => {
      const quote = (r.text?.text || r.originalText?.text || "").trim();
      const authorName = (r.authorAttribution?.displayName || "").trim();
      if (!quote || !authorName) return null;
      return {
        id: r.name || `google-review-${index}`,
        quote,
        authorName,
        rating: Math.min(5, Math.max(1, Math.round(r.rating || 5))),
        authorUri: r.authorAttribution?.uri || null,
        relativeTime: r.relativePublishTimeDescription || null,
        publishTime: r.publishTime || null,
      } satisfies GoogleReview;
    })
    .filter((r): r is GoogleReview => Boolean(r));

  return {
    placeId: id,
    displayName: data.displayName?.text || null,
    rating: typeof data.rating === "number" ? data.rating : null,
    userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    googleMapsUri: data.googleMapsUri || null,
    reviews,
    fetchedAt: new Date().toISOString(),
  };
}

/** Cached Place Details reviews — 24h TTL (keeps API cost near $0). */
export async function getGooglePlaceReviews(placeId: string): Promise<GooglePlaceReviews | null> {
  const id = normalizePlaceId(placeId);
  if (!hasGooglePlacesConfig(id)) return null;

  return unstable_cache(
    () => fetchPlaceReviewsUncached(id),
    ["google-place-reviews", id],
    { revalidate: 60 * 60 * 24, tags: ["google-reviews"] },
  )();
}

/** Bypass cache — for admin “Refresh now”. */
export async function fetchGooglePlaceReviewsFresh(placeId: string) {
  return fetchPlaceReviewsUncached(placeId);
}
