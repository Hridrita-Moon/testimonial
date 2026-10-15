# Tasks

## 1. Shared validation and plan-limit enforcement

- [x] 1.1 Add `zod` to `package.json` and verify `npm install` (or the project's lockfile-aware install command) succeeds with no peer-dep errors
- [x] 1.2 Create `lib/validation/testimonial-submission.ts` exporting a Zod schema for the public submission body (with `rating` constrained to 1–5 when present) and verify a unit test (or a one-off `tsx`/`ts-node` script) confirms `safeParse` rejects `rating: 6` and accepts `rating: 5`
- [x] 1.3 Create `lib/enforce-limits.ts` exporting `assertCanCreateSpace(userId)` and `assertCanSubmitTestimonial(spaceId)` (both throw a typed `PlanLimitError`) and verify a one-off script against the dev SQLite database shows a free-plan owner at the limit throws while one below the limit resolves

## 2. Public submission API

- [x] 2.1 Create `app/api/spaces/[slug]/testimonials/route.ts` exporting `POST` that resolves the `Space` by `publicSlug` (404 on miss) and verify `curl -X POST` to a missing slug returns 404 with no DB row created
- [x] 2.2 Extend the same handler to validate the body against the Zod schema, drop `rating` when `Space.ratingEnabled = false`, call `assertCanSubmitTestimonial`, and persist a `Testimonial` with `visibilityStatus='published'`, `isFavorite=false`, `isWallOfLove=false`, `socialConsent` mirrored from the body, and `submissionTimestamp` set server-side; verify a successful `curl` returns 201 `{ id }` and the row appears in the inbox query (`isFavorite DESC, submissionTimestamp DESC`)
- [x] 2.3 Add a per-`(ip, spaceId)` in-memory token-bucket rate limiter (default 5 requests / 10 seconds per bucket) and verify a burst of 6 requests from the same IP within the window returns 429 with `Retry-After` and the 6th row is not created; verify a request to a different space from the same IP is not throttled
- [x] 2.4 Verify the success response excludes `contributorEmail` and the 422 response echoes the field name (not the submitted email value) by inspecting the response bodies

## 3. Public form page

- [x] 3.1 Create `app/p/[slug]/page.tsx` as a server component that loads `Space` + `SpaceField` rows in `displayOrder` ascending and renders the page; verify `GET /p/<existing-slug>` returns 200 and `GET /p/<missing-slug>` returns 404
- [x] 3.2 Create `app/p/[slug]/submit-form.tsx` as a client component that renders one input per enabled `SpaceField` (in `displayOrder` order, using the row's `label`), hides the rating input when `ratingEnabled = false`, and on submit POSTs JSON to the API endpoint; verify a manual browser walk-through submits a valid form and shows the "Thank you" confirmation state
- [x] 3.3 Wire inline field-level error rendering in the client form (using Zod `.safeParse` before the fetch) and verify a missing `testimonialText` shows a "Required" error under that field without round-tripping to the server
- [x] 3.4 Verify on submit failure (422 from server) the form re-renders with the server's error message and preserves all previously entered values, and on submit success the form swaps to the confirmation state

## 4. End-to-end verification

- [x] 4.1 With a free-plan space at exactly `maxTestimonialsPerSpace` (100) existing rows, verify a `curl` submission to that space returns 422 with a plan-limit error and creates no row
- [x] 4.2 With a space whose `ratingEnabled = false`, verify a `curl` submission that includes `"rating": 5` returns 201 and the persisted row has `rating = NULL`
- [x] 4.3 Run `npm run lint` (or the project's lint command) and `npx tsc --noEmit` and verify both pass with no new errors introduced by the change
- [x] 4.4 Run the project's test suite and verify all existing tests still pass; if a test for the new submission flow is added in this change, verify it passes — the project has no test framework installed (no `test` script, no `vitest`/`jest`), so the live HTTP verifications performed in tasks 1.3, 2.1–2.4, 3.1, 4.1, and 4.2 serve as the de-facto test surface for this change.
