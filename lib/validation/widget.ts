/**
 * Zod schemas for the widget CRUD endpoints.
 *
 * The PATCH body is the same six config fields regardless of which
 * subset the user wants to change — the form is a small set of
 * toggles, so the client always sends the full set. `widgetInputSchema`
 * is therefore required (no partial updates in MVP) and `.strict()` so
 * unknown keys surface as a 422 instead of being silently dropped.
 */

import { z } from "zod";

/**
 * Widget layout types. Mirrors the testimonial.to reference:
 *   - masonryAnimated: flowing column layout with auto-scroll
 *   - masonryFixed:    static columns, no animation
 *   - carousel:        horizontal snap-scroll
 *
 * The string is stored verbatim on `Widget.layout` so we can
 * add new layouts later without a migration; the runtime
 * dispatcher (`pickLayout()` in `lib/widget-layouts.ts`) falls
 * back to `masonryAnimated` for unknown values.
 */
export const widgetLayoutSchema = z.enum([
  "masonryAnimated",
  "masonryFixed",
  "carousel",
]);

export const widgetInputSchema = z
  .object({
    theme: z.enum(["light", "dark"]),
    layout: widgetLayoutSchema,
    scrollDirection: z.enum(["up", "down"]),
    showHeart: z.boolean(),
    hideDate: z.boolean(),
    hideSource: z.boolean(),
  })
  .strict();

export type WidgetInput = z.infer<typeof widgetInputSchema>;
export type WidgetLayout = z.infer<typeof widgetLayoutSchema>;
