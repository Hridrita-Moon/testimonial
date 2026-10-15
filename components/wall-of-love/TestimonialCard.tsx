/**
 * Single testimonial card on the Wall of Love.
 *
 * Shared between:
 *   - the public page at `/p/<slug>/wall` (no auth, no sidebar);
 *   - the owner preview at `/dashboard/wall` (auth required, sidebar
 *     inherited from the dashboard layout).
 *
 * The card is intentionally presentational — the public page passes
 * a plain "show as published" flag, the dashboard preview can later
 * wire up action buttons per card by composing around this
 * component. Today the dashboard version is read-only per the
 * owner's chosen scope.
 *
 * Privacy: the `additionalValues` JSON column may carry the
 * contributor's email or other PII depending on what the space's
 * `SpaceField` config accepted. The card never reads or renders
 * `additionalValues.email`; we only extract `companyName` (the one
 * public-safe field the data-model exposes on the wall).
 */

interface TestimonialCardProps {
  contributorName: string;
  testimonialText: string;
  rating: number | null;
  ratingEnabled: boolean;
  additionalValues: unknown;
  /**
   * When true, append a tiny "preview" affordance (used by the
   * dashboard version to distinguish from the public surface).
   * Has no effect on rendering today — kept for forward
   * compatibility with owner-only actions.
   */
  isOwnerPreview?: boolean;
}

export function TestimonialCard({
  contributorName,
  testimonialText,
  rating,
  ratingEnabled,
  additionalValues,
}: TestimonialCardProps) {
  const company = extractCompany(additionalValues);
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <blockquote className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
        &ldquo;{testimonialText}&rdquo;
      </blockquote>
      <footer className="mt-4 flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {contributorName}
          </p>
          {company ? (
            <p className="text-xs text-zinc-500">{company}</p>
          ) : null}
        </div>
        {ratingEnabled && rating != null ? (
          <p
            className="text-amber-600 dark:text-amber-400"
            aria-label={`Rating: ${rating} out of 5`}
          >
            {"★".repeat(rating)}
            <span className="text-zinc-300 dark:text-zinc-700">
              {"★".repeat(5 - rating)}
            </span>
          </p>
        ) : null}
      </footer>
    </li>
  );
}

/**
 * Pull `companyName` from the `additionalValues` JSON column.
 * Returns null when the field is absent, when the column is
 * null, or when the value is not a string. The wall only renders
 * this one field of the three possible extras.
 */
function extractCompany(additionalValues: unknown): string | null {
  if (!additionalValues || typeof additionalValues !== "object") return null;
  const v = (additionalValues as Record<string, unknown>).companyName;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
