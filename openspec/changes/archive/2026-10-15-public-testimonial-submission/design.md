# Design

## Context

The data model is in place and persisted, and `lib/plan-limits.ts` already exposes `PLAN_LIMITS` and `isPremium`/`getLimitsForPlan`. The app has no public surface yet — `app/page.tsx` is a placeholder, and `app/dashboard/billing` is the only authenticated page. There is no `lib/enforce-limits.ts`, no `app/p/`, and no `app/api/spaces/`.

The submission path must produce rows that respect three contracts: (1) the persisted shape from the `data-model` capability, (2) the per-space `SpaceField` config, and (3) the plan limit on the space owner's subscription. The form and the API endpoint must agree on the same field set — building two separate validators would let them drift.

## Goals / Non-Goals

**Goals:**
- One validation schema shared between client (for inline errors) and server (for the authoritative check).
- Server-side route handler (not a server action) so the endpoint is reachable from any client and rate-limited at the edge.
- Plan-limit gate as a service-layer function so future dashboard mutations (`createSpace`, etc.) reuse the same enforcement.
- Slug-based routing with a single 404 path; no client-side redirects on unknown slugs.
- No new persistent storage for rate limits; rely on a single in-memory token bucket keyed by `(ip, spaceId)`.

**Non-Goals:**
- No authentication / captcha / submission tokens (deferred to v2 per data-model §14).
- No email confirmation, no `contributorEmail` exposure in the success/error response.
- No inline image uploads (the `profilePhoto` field is a URL string).
- No moderation queue, no `spam` / `archived` statuses.

## Decisions

### 1. Server route handler over a Next.js Server Action
The spec calls for an endpoint reachable from any unauthenticated client (including the embed JS snippet, future mobile clients, and curl). A Server Action is bound to the Next.js server's RSC pipeline and is not addressable as a stable public URL. A `POST /api/spaces/[slug]/testimonials` route handler is reachable from everywhere and is the contract documented in `data-model.md` §11. Trade-off: we write a thin client component that does `fetch(...)` and handles JSON responses, instead of `useFormState`. Accepted because the spec needs explicit status codes (201, 404, 422, 429) and the form is small.

### 2. Shared Zod schema in `lib/validation/testimonial-submission.ts`
A single `z.object({...})` exports both the type and the parser. The client uses `.safeParse` for inline field errors; the server uses `.safeParse` again as the authoritative check after resolving the `SpaceField` config. This guarantees client and server cannot drift on required fields, allowed values, or the `rating` 1–5 range. The schema is permissive about extra fields (`additionalValues` carries company/social/photo) but rejects unknown top-level fields so typos fail loudly.

### 3. Plan-limit gate lives in `lib/enforce-limits.ts`, not in the route handler
The spec for `assertCanSubmitTestimonial(spaceId)` is reused later by any other entry point that adds testimonials (imports, migrations). The function takes a `spaceId`, joins to `Space` → `ownerId` → `Subscription` to resolve the plan, and either resolves (count < limit) or throws a typed error the route handler converts to 422. The function never throws on a missing `Subscription` row — per data-model, a user with no row is treated as `plan = 'free'`, `status = 'active'`. Trade-off: an extra join per submission. Accepted because submissions are low-volume per space and the index on `(spaceId, submissionTimestamp)` already covers the count query.

### 4. Rating drop is server-side, not client-side
When `Space.ratingEnabled = false`, the server removes `rating` from the parsed body before persisting, regardless of what the client sent. The client form does not even render the rating input in that case (it reads `Space.ratingEnabled` from the page props). Belt-and-braces: the server is authoritative because the rating input could be tampered with from devtools.

### 5. Rate limit is a single in-process token bucket per (ip, spaceId)
The endpoint uses a `Map<string, TokenBucket>` keyed by `${ip}::${spaceId}`. Each bucket holds N tokens and refills at R per second; on 0 tokens, the handler returns 429 with `Retry-After`. Different spaces get independent counters, satisfying the "different spaces are tracked independently" spec scenario. The map is process-local, which is correct for a single-instance dev environment and acceptable for MVP — multi-instance deployments would need a shared store, but that's a v2 concern (data-model §14: "Abuse protection — rate-limited at the edge" implies the edge layer is the long-term home, not the route handler). A `// TODO: replace with edge KV when we add a second instance` comment is left at the bucket declaration.

### 6. Form page is a Server Component that renders a Client form
`app/p/[slug]/page.tsx` is a server component that loads the `Space` + its `SpaceField` rows from Prisma (one query with `include: { fields: { orderBy: { displayOrder: 'asc' } } }`). It passes the resolved shape as props to a `submit-form.tsx` client component. The client form holds local state for each field, runs Zod on submit for inline errors, and POSTs to the API. Trade-off: hydration cost on the public page. Accepted because the form is small and the server-rendered initial state is what the contributor actually sees; we keep `useState` count to one (form values) and one (submission status: idle | submitting | success | error).

### 7. Visibility defaults are server-set, not client-supplied
The client never sends `isFavorite`, `isWallOfLove`, or `visibilityStatus` — the server constructs them. The spec is explicit that the persisted row starts with `isFavorite = false`, `isWallOfLove = false`, `visibilityStatus = 'published'`. The Zod schema strips these if present so a tampered client cannot smuggle them in.

## Risks / Trade-offs

- [Rate limit is process-local] → Mitigation: a `// TODO` comment + the existing `data-model.md` §11 "rate-limited at the edge" deferral. When we add a second instance, this code is the seam.
- [Plan-limit count query joins across two tables on every submit] → Mitigation: the `@@index([spaceId, submissionTimestamp])` on `Testimonial` covers the count; profile if it shows up in a flame graph before optimizing.
- [Slug collision appends a 4-char suffix on space creation — but the public route uses the slug as input verbatim] → Mitigation: no-op. The slug is unique-by-`@@unique`; if the contributor mistypes, the lookup 404s. The server never re-resolves or rewrites the slug.
- [Form initial render leaks the space's prompt + title + enabled field labels to anyone] → Mitigation: this is intentional — they are the public surface. Hidden `SpaceField` rows and `contributorEmail` values from prior submissions never appear in the HTML.
- [Client form posts JSON; we accept `application/json` only] → Mitigation: 415 on other content types. CORS is intentionally not enabled (same-origin only).
- [Zod is a new dependency] → Mitigation: confirm it's already in `package.json` during implementation; if not, add it as a single dependency with no other transitive changes.

## Migration Plan

- Additive change, no schema migration required.
- Deploy order: ship `lib/enforce-limits.ts` and `lib/validation/testimonial-submission.ts` first (no consumer yet), then the API route, then the public page. Each step is independently deployable.
- Rollback: remove the three new directories. No database rollback needed.

## Open Questions

(none — every design choice that would have affected the spec or the task breakdown is resolved above.)
