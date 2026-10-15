/**
 * Zod schemas for the inbox surface.
 *
 *   - `inboxFilterSchema` validates the `searchParams` on
 *     `/dashboard/inbox`. All fields are optional; an empty
 *     object means "no filter".
 *   - `editTestimonialSchema` is the body for `PATCH
 *     /api/testimonials/<id>`. It re-validates the same
 *     contributor fields the public submission schema does
 *     (the public schema is in `testimonial-submission.ts`).
 *   - `visibilitySchema` validates the body of the visibility
 *     and single-flag action routes.
 */

import { z } from "zod";

const isoDateString = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date")
  .transform((s) => new Date(s));

export const inboxFilterSchema = z
  .object({
    spaceId: z.string().trim().min(1).max(60).optional(),
    rating: z
      .union([z.literal("1"), z.literal("2"), z.literal("3"), z.literal("4"), z.literal("5")])
      .optional(),
    visibility: z.enum(["published", "hidden"]).optional(),
    fromDate: isoDateString.optional(),
    toDate: isoDateString.optional(),
    q: z.string().trim().max(200).optional(),
    favorite: z
      .union([z.literal("1"), z.literal("true")])
      .optional()
      .transform((v) => v === "1" || v === "true"),
  })
  .strict();

export type InboxFilter = z.infer<typeof inboxFilterSchema>;

export const editTestimonialSchema = z
  .object({
    contributorName: z.string().trim().min(1).max(200),
    contributorEmail: z.string().trim().email().max(320),
    testimonialText: z.string().trim().min(1).max(5000),
    rating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .nullable()
      .optional(),
    additionalValues: z
      .object({
        companyName: z.string().trim().max(200).optional(),
        socialLinks: z.string().trim().max(500).optional(),
        profilePhoto: z.string().trim().max(500).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export type EditTestimonialInput = z.infer<typeof editTestimonialSchema>;

export const visibilitySchema = z
  .object({ visibility: z.enum(["published", "hidden"]) })
  .strict();

export const favoriteSchema = z
  .object({ favorite: z.boolean() })
  .strict();

export const wallOfLoveSchema = z
  .object({ wallOfLove: z.boolean() })
  .strict();
