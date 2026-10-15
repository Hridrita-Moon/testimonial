/**
 * Zod schemas for the spaces CRUD endpoints.
 *
 * The create and update bodies share the same shape. The 6 default
 * `SpaceField` rows are auto-seeded on create (the three core
 * fields are always required + enabled; the three optional fields
 * are enabled/disabled per `enabledFields`).
 *
 * Length limits match the data-model spec: title 1-120, subtitle
 * 0-200, prompt 1-2000, slug 3-60 kebab-case. The slug is optional
 * on input; the service auto-generates it from the title when
 * omitted.
 */

import { z } from "zod";

const slugRegex = /^[a-z0-9-]+$/;

export const enabledFieldsSchema = z
  .object({
    companyName: z.boolean().optional(),
    socialLinks: z.boolean().optional(),
    profilePhoto: z.boolean().optional(),
  })
  .strict()
  .optional();

export const spaceInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    subtitle: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional()
      .or(z.literal("")),
    prompt: z
      .string()
      .trim()
      .min(1, "Prompt is required")
      .max(2000, "Prompt is too long (max 2000)"),
    theme: z.enum(["light", "dark"]),
    ratingEnabled: z.boolean(),
    publicSlug: z
      .string()
      .trim()
      .regex(slugRegex, "Slug can only contain lowercase letters, numbers, and hyphens")
      .min(3)
      .max(60)
      .optional()
      .or(z.literal("")),
    enabledFields: enabledFieldsSchema,
  })
  .strict();

export type SpaceInput = z.infer<typeof spaceInputSchema>;
