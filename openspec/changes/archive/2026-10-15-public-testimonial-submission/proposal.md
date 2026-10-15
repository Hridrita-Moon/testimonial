# Proposal

## Why

The MVP data model (persisted schema, slug routing, plan limits) is in place, but a contributor who visits `/p/<slug>` today has no way to actually submit a testimonial. Without a public submission surface, the inbox stays empty, the Wall of Love has nothing to render, and the embed JS snippet has nothing to fetch. This change closes that loop by adding the unauthenticated form page and the API endpoint that materializes a `Testimonial` row from a contributor's submission, while enforcing the per-space field configuration and the plan limit on new submissions.

## What Changes

- Add a public form page at `app/p/[slug]/page.tsx` that loads a space by `publicSlug`, renders the form fields defined by the space's `SpaceField` rows in `displayOrder` ascending, and submits via a server action.
- Add a server action / route handler `POST /api/spaces/[slug]/testimonials` that:
  - Resolves the space by `publicSlug` (404 if missing).
  - Re-validates every submitted value against the space's `SpaceField` config (enabled + required).
  - Drops a `rating` from the body when `Space.ratingEnabled = false` (still stored as `null`).
  - Calls `assertCanSubmitTestimonial(spaceId)` from `lib/enforce-limits.ts` (422 on reject).
  - Persists a `Testimonial` with `visibilityStatus = 'published'`, `isFavorite = false`, `isWallOfLove = false`, `submissionTimestamp = now()`, and a server-set `socialConsent`.
  - Returns `201 { id }` on success and a structured validation error otherwise.
- Add `lib/enforce-limits.ts` with `assertCanCreateSpace(userId)` and `assertCanSubmitTestimonial(spaceId)`, both backed by `lib/plan-limits.ts`.
- Add a shared Zod schema `lib/validation/testimonial-submission.ts` (single source of truth for both client and server validation).
- Display a "Thank you" confirmation state on the public form after a successful submit; on validation failure, show field-level errors and preserve entered values.

## Capabilities

### New Capabilities

- `public-submission`: Lets an unauthenticated visitor submit a testimonial to a space they have been invited to. Owns the public form page (`/p/[slug]`), the server-side submission endpoint, the per-space field re-validation, the rating-when-disabled handling, and the plan-limit gate on new submissions. Boundary is "any code path whose input is a contributor's submission, not a logged-in dashboard user" — so it includes the public form page, the public submit endpoint, and the shared submission schema. The `data-model` capability already covers what the database guarantees; this capability covers the public surface that produces rows in that table.

### Modified Capabilities

- (none — this change does not change existing requirements; it consumes the `data-model` capability)

## Impact

- New files:
  - `app/p/[slug]/page.tsx` (server component, loads space + fields, renders client form)
  - `app/p/[slug]/submit-form.tsx` (client component, posts to the submission endpoint)
  - `app/api/spaces/[slug]/testimonials/route.ts` (POST handler)
  - `lib/enforce-limits.ts` (plan-limit assertions, also consumed by future dashboard mutations)
  - `lib/validation/testimonial-submission.ts` (Zod schema)
  - `openspec/changes/public-testimonial-submission/specs/public-submission/spec.md` (delta spec)
- Touched areas: none (additive change; no existing routes modified).
- Dependencies: `zod` (for shared validation schema; add to `package.json` if not already present).
- The public endpoint is unauthenticated and exposes no `passwordHash`, `contributorEmail` (private by design — the contributor's own email is persisted but never returned by this endpoint's success response), or other owners' spaces.
- Plan-limit enforcement uses `PLAN_LIMITS` from `lib/plan-limits.ts`; no new env vars or constants introduced.
