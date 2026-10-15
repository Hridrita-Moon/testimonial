/**
 * Key translation for the public testimonial submission form.
 *
 * The form's input keys come from the `SpaceField.fieldType` column,
 * which the seed and existing spaces populate with the *user-facing*
 * names `name`, `email`, `testimonialText` (plus the three optional
 * `companyName`, `socialLinks`, `profilePhoto`). The server-side
 * validation schema (`testimonialSubmissionSchema`) and the
 * `Testimonial` model instead use `contributorName` and
 * `contributorEmail` for the two core fields.
 *
 * Without a translation layer the form sends a body that the strict
 * server Zod schema rejects with 422 (`field: "contributorName"`,
 * `field: "contributorEmail"`) and the contributor's data never
 * persists. Translating at the boundary keeps both layers honest:
 * the form deals in form-shaped keys, the server deals in
 * schema-shaped keys, and a single function maps between them.
 *
 * Symmetric maps are exposed so the form can also pin a server-side
 * error (`field: "contributorName"`) back to the right input
 * (`errors["name"]`).
 */

export const INPUT_KEY_TO_SCHEMA_KEY: Readonly<Record<string, string>> = {
  name: "contributorName",
  email: "contributorEmail",
  testimonialText: "testimonialText",
};

export const SCHEMA_KEY_TO_INPUT_KEY: Readonly<Record<string, string>> = {
  contributorName: "name",
  contributorEmail: "email",
  testimonialText: "testimonialText",
};

/**
 * Translate a form-shaped values object (e.g. `{ name, email,
 * testimonialText }`) into a schema-shaped body (e.g.
 * `{ contributorName, contributorEmail, testimonialText }`).
 * Unknown keys pass through unchanged so the optional
 * `additionalValues` bag is preserved verbatim.
 */
export function translateToSchemaBody(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    const schemaKey = INPUT_KEY_TO_SCHEMA_KEY[k] ?? k;
    out[schemaKey] = v;
  }
  return out;
}

/** Inverse: given a server-side field name, return the input key. */
export function inputKeyFor(schemaField: string): string {
  return SCHEMA_KEY_TO_INPUT_KEY[schemaField] ?? schemaField;
}
