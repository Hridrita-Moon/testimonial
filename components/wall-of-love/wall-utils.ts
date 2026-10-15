/**
 * Tiny shared helpers for the wall renderers.
 *
 * Kept separate from the component files so the renderers stay
 * focused on layout and the helpers can be unit-tested in
 * isolation if needed.
 */

/**
 * Pull `companyName` from the `additionalValues` JSON column.
 * Returns null when the field is absent, when the column is
 * null, or when the value is not a non-empty string. The wall
 * only renders this one field of the three possible extras; the
 * rest are reserved for the owner-only inbox view.
 */
export function extractCompany(additionalValues: unknown): string | null {
  if (!additionalValues || typeof additionalValues !== "object") return null;
  const v = (additionalValues as Record<string, unknown>).companyName;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
