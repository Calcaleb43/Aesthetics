"use client";

import { useEffect, useState, useTransition } from "react";

type GoogleStatus = {
  configured?: boolean;
  keyConfigured?: boolean;
  placeIdConfigured?: boolean;
  placeId?: string;
  displayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  googleMapsUri?: string | null;
  reviews?: { authorName: string; rating: number; quote: string }[];
  fetchedAt?: string;
  message?: string;
  error?: string;
};

export function GoogleReviewsPanel() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/admin/google-reviews");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || "Could not load Google reviews status");
        setStatus(data);
        return;
      }
      setStatus(data);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError("");
    const res = await fetch("/api/admin/google-reviews", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Refresh failed");
      return;
    }
    setStatus(data);
  }

  return (
    <div className="admin-card mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Google Places reviews</h2>
          <p className="mt-1 text-sm text-white/50">
            Live reviews (up to ~5) from Place Details. Cached 24 hours. Curated testimonials below
            are used only when Google is not configured or returns nothing.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn !py-2"
          disabled={pending || !status?.configured}
          onClick={() => void refresh()}
        >
          Refresh now
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 grid gap-2 text-sm text-white/70">
        <p>
          API key:{" "}
          <span className={status?.keyConfigured ? "text-[#c6a75e]" : "text-red-300"}>
            {status?.keyConfigured ? "configured" : "missing (GOOGLE_PLACES_API_KEY)"}
          </span>
        </p>
        <p>
          Place ID:{" "}
          <span className={status?.placeIdConfigured ? "text-[#c6a75e]" : "text-red-300"}>
            {status?.placeIdConfigured ? status.placeId : "set in Settings"}
          </span>
        </p>
        {status?.displayName ? (
          <p>
            Place: <span className="text-white">{status.displayName}</span>
            {status.rating != null ? ` · ${status.rating.toFixed(1)}★` : ""}
            {status.userRatingCount != null ? ` · ${status.userRatingCount} reviews` : ""}
          </p>
        ) : null}
        {status?.fetchedAt ? (
          <p className="text-xs text-white/40">
            Last fetch: {new Date(status.fetchedAt).toLocaleString("en-CA")}
          </p>
        ) : null}
        {status?.message ? <p className="text-white/45">{status.message}</p> : null}
      </div>

      {status?.reviews?.length ? (
        <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {status.reviews.map((r, i) => (
            <li key={`${r.authorName}-${i}`} className="text-sm text-white/70">
              <span className="text-[#c6a75e]">{"★".repeat(r.rating)}</span>{" "}
              <span className="font-medium text-white">{r.authorName}</span>
              <p className="mt-1 line-clamp-2 text-white/50">“{r.quote}”</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
