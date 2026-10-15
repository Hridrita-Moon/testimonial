/**
 * Shared validation schema for the public testimonial submission
 * endpoint and the public form's client-side preflight.
 *
 * Why a single Zod schema for both sides:
 *   - The contributor's browser runs `.safeParse` to render inline
 *     field-level errors without a round-trip to the server.
 *   - The route handler at `app/api/spaces/[slug]/testimonials/route.ts`
 *     runs the same parser as the authoritative check after the
 *     space's `SpaceField` config is loaded.
 *   - This guarantees the client and the server cannot drift on
 *     required fields, the `rating` 1–5 range, or the `additionalValues`
 *     shape.
 *
 * Visibility flags (`isFavorite`, `isWallOfLove`, `visibilityStatus`)
 * are intentionally NOT in this schema — the server sets them
 * unconditionally on persist. A tampered client cannot smuggle them
 * in because the route handler builds the row from a typed object,
 * not from the raw parsed body.
 */

import { z } from "zod";

/**
 * 1–5 inclusive. The server drops this value before persisting when
 * the target `Space` has `ratingEnabled = false`, so this schema
 * enforces the bounds only.
 */
const ratingSchema = z.number().int().min(1).max(5);

/**
 * `additionalValues` is a free-form bag carrying the three optional
 * strings. We do NOT enforce that all three keys are present — they
 * may be omitted when the corresponding `SpaceField` is disabled or
 * when the contributor simply leaves them blank.
 */
const additionalValuesSchema = z
  .object({
    companyName: z.string().trim().max(200).optional(),
    socialLinks: z.string().trim().max(500).optional(),
    profilePhoto: z.string().trim().max(500).optional(),
  })
  .strict()
  .optional();

/**
 * Shape of a single public submission request body.
 *
 * Field-level notes:
 *   - `contributorName`, `contributorEmail`, and `testimonialText`
 *     are non-empty after trimming. The route handler additionally
 *     rejects the request when one of these is missing AND the
 *     corresponding `SpaceField` is `required = true` (which it
 *     always is for the three core fields, per the data-model
 *     invariants).
 *   - `rating` is optional. The route handler strips it when
 *     `Space.ratingEnabled = false`.
 *   - `additionalValues` is optional and forwarded verbatim.
 *   - `socialConsent` defaults to `false` server-side if missing.
 */
export const testimonialSubmissionSchema = z
  .object({
    contributorName: z.string().trim().min(1).max(200),
    contributorEmail: z.string().trim().email().max(320),
    testimonialText: z.string().trim().min(1).max(5000),
    rating: ratingSchema.optional(),
    additionalValues: additionalValuesSchema,
    socialConsent: z.boolean().optional(),
  })
  .strict();

export type TestimonialSubmission = z.infer<typeof testimonialSubmissionSchema>;