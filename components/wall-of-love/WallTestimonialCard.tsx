/**
 * Lightweight testimonial card used by the masonry / carousel
 * renderers. Differs from the public-wall version in two ways:
 *
 *   - The data props are a flat `WallTestimonialItem` shape
 *     (already in the form the renderers want), and the
 *     component is presentational only — no extra JSON parsing
 *     or DB-shaped data leaking through.
 *   - The favorite heart is shown inline (testimonials
 *     surfaced on the wall are pre-ordered with favorites
 *     first), and the date is hidden when `hideDate` is on.
 *
 * Used by both the public wall at `/p/<slug>/wall` and the
 * dashboard manager's `AnimatedWallCard` so a single
 * component renders both surfaces — and any future visual
 * change happens in one place.
 */

import { extractCompany } from "@/components/wall-of-love/wall-utils";

export interface WallTestimonialItem {
  id: string;
  contributorName: string;
  testimonialText: string;
  rating: number | null;
  additionalValues: unknown;
  isFavorite: boolean;
  /** ISO string — easier to pass across the RSC boundary than
   *  a Date object. The card formats it for display. */
  submissionTimestamp: string;
}

interface WallTestimonialCardProps {
  item: WallTestimonialItem;
  ratingEnabled: boolean;
  theme: "light" | "dark";
  hideDate: boolean;
}

export function WallTestimonialCard({
  item,
  ratingEnabled,
  theme,
  hideDate,
}: WallTestimonialCardProps) {
  const isDark = theme === "dark";
  const company = extractCompany(item.additionalValues);
  const date = new Date(item.submissionTimestamp);
  const dateLabel = isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <article
      className={
        isDark
          ? "flex h-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm"
          : "flex h-full flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={
            isDark
              ? "truncate text-sm font-semibold text-zinc-100"
              : "truncate text-sm font-semibold text-zinc-900"
          }
        >
          {item.contributorName}
        </p>
        {ratingEnabled && item.rating != null ? (
          <span
            className="text-sm text-amber-500"
            aria-label={`Rating: ${item.rating} out of 5`}
          >
            {"★".repeat(item.rating)}
            <span className={isDark ? "text-zinc-700" : "text-zinc-300"}>
              {"★".repeat(5 - item.rating)}
            </span>
          </span>
        ) : null}
      </div>
      <p
        className={
          isDark
            ? "whitespace-pre-line text-sm leading-relaxed text-zinc-300"
            : "whitespace-pre-line text-sm leading-relaxed text-zinc-700"
        }
      >
        &ldquo;{item.testimonialText}&rdquo;
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px]">
        <span
          className={
            isDark
              ? "flex items-center gap-1 text-zinc-500"
              : "flex items-center gap-1 text-zinc-500"
          }
        >
          {item.isFavorite ? <span aria-hidden>♥</span> : null}
          {item.isFavorite ? "Top pick" : "On wall"}
          {company ? <> · {company}</> : null}
          {!hideDate && dateLabel ? <> · {dateLabel}</> : null}
        </span>
      </div>
    </article>
  );
}
