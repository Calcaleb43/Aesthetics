import { ScrollReveal } from "@/components/site/ScrollReveal";
import type { GooglePlaceReviews } from "@/lib/google/places-reviews";
import type { TestimonialRecord } from "@/lib/content/seed";

function Stars({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <p className="text-[0.85rem] tracking-[0.2em] text-[var(--gold-deep)]" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-black/15">{"★".repeat(Math.max(0, 5 - n))}</span>
    </p>
  );
}

type DisplayReview = {
  id: string;
  quote: string;
  authorName: string;
  rating: number;
  sourceLabel: string;
  sourceUrl?: string | null;
  relativeTime?: string | null;
};

function fromGoogle(data: GooglePlaceReviews): DisplayReview[] {
  return data.reviews.map((r) => ({
    id: r.id,
    quote: r.quote,
    authorName: r.authorName,
    rating: r.rating,
    sourceLabel: "Google review",
    sourceUrl: r.authorUri,
    relativeTime: r.relativeTime,
  }));
}

function fromCurated(rows: TestimonialRecord[]): DisplayReview[] {
  return rows.map((t) => ({
    id: t.id,
    quote: t.quote,
    authorName: t.authorName,
    rating: t.rating,
    sourceLabel: t.source === "google" ? "Google review" : "Client review",
    sourceUrl: t.sourceUrl,
  }));
}

export function TestimonialsSection({
  google,
  curated = [],
  googleReviewsUrl,
}: {
  google?: GooglePlaceReviews | null;
  curated?: TestimonialRecord[];
  googleReviewsUrl?: string;
}) {
  const reviews = google?.reviews.length ? fromGoogle(google) : fromCurated(curated);
  if (!reviews.length) return null;

  const mapsHref = googleReviewsUrl || google?.googleMapsUri || undefined;
  const summaryRating = google?.rating ?? null;
  const summaryCount = google?.userRatingCount ?? null;

  return (
    <section className="section">
      <div className="container">
        <ScrollReveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Client voices</p>
              <h2 className="display mt-4 text-4xl md:text-5xl lg:text-6xl">What they say</h2>
              {summaryRating != null ? (
                <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--ink-soft)]">
                  <Stars rating={summaryRating} />
                  <span>
                    <span className="font-semibold text-[var(--ink)]">{summaryRating.toFixed(1)}</span>
                    {summaryCount != null ? ` · ${summaryCount.toLocaleString("en-CA")} Google reviews` : " on Google"}
                  </span>
                </p>
              ) : null}
            </div>
            {mapsHref ? (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="btn">
                See Google reviews
              </a>
            ) : null}
          </div>
        </ScrollReveal>

        <div className="mt-12 space-y-0 border-t border-[var(--line)]">
          {reviews.map((t, index) => (
            <ScrollReveal key={t.id} delay={index * 80}>
              <figure className="grid gap-4 border-b border-[var(--line)] py-10 md:grid-cols-[7rem_1fr] md:gap-10">
                <div className="pt-1">
                  <Stars rating={t.rating} />
                </div>
                <div>
                  <blockquote className="display text-2xl leading-snug md:text-3xl md:leading-snug">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold tracking-[0.04em]">{t.authorName}</span>
                    <span className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--gold-deep)]">
                      {t.sourceLabel}
                    </span>
                    {t.relativeTime ? (
                      <span className="text-xs text-[var(--ink-soft)]">{t.relativeTime}</span>
                    ) : null}
                    {t.sourceUrl ? (
                      <a
                        href={t.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-soft)] underline decoration-black/20 underline-offset-4 transition hover:text-[var(--ink)]"
                      >
                        On Google
                      </a>
                    ) : null}
                  </figcaption>
                </div>
              </figure>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={100}>
          <p className="mt-8 text-xs tracking-[0.04em] text-[var(--ink-soft)]">
            Reviews sourced from Google.{" "}
            {mapsHref ? (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                View on Google Maps
              </a>
            ) : null}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
