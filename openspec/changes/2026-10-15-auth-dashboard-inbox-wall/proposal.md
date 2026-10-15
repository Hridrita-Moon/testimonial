# Proposal

## Why

The MVP data model and the public submission surface are in place: a contributor can visit `/p/<slug>`, fill in a configured form, and persist a `Testimonial` row. But the owner side of the product does not exist yet. There is no authentication, no dashboard, no inbox, no Wall of Love, and the existing `/dashboard/billing` page identifies the user via a `?userId=` query-string shim (flagged with `TODO`). The MVP cannot be demonstrated end-to-end: an owner cannot sign up, cannot create a space from the UI, cannot see incoming testimonials, cannot curate the public Wall of Love, and the `?userId=` shim is a security hole in anything that ships to production.

This change closes the owner side. It adds the three missing capabilities (auth, dashboard spaces CRUD, inbox + public Wall of Love) as one OpenSpec change with three delta specs, then threads the new session-based identity through the existing billing page so the entire `/dashboard/*` surface is consistently authenticated.

## What Changes

- Add a credentials-based authentication flow using Auth.js v5 (`next-auth@beta`) with a JWT session strategy. The `User` table is already auth-ready (`passwordHash` is present); no `Account`/`Session`/`VerificationToken` tables are required for the JWT-only path.
- Add a `register` API route that hashes the password with `bcryptjs` and creates a `User`, returning 409 on duplicate email. The same form auto-signs the user in after registration.
- Add sign-up, sign-in, and sign-out pages under an `(auth)` route group. The sign-out button is mounted in the dashboard top bar.
- Add a Next.js middleware (or `proxy.ts` if Next 16.4 prefers that name — verified on first run) that protects `/dashboard/*` and any future `/account/*` paths, redirecting unauthenticated requests to `/sign-in?next=<original>`. Public paths (`/`, `/p/*`, `/api/spaces/*/testimonials`, `/api/auth/*`, `/api/stripe/webhook`, static assets) are whitelisted.
- Add a dashboard layout and index page that shows the current plan, usage against the plan limits, total testimonial count, average rating (when ratings are enabled), and a recent activity list. Quick links to spaces, inbox, embeds (placeholder), and billing.
- Add spaces CRUD: list, create, edit, delete spaces and their `SpaceField` config. The create flow auto-seeds the 6 default `SpaceField` rows (3 core always required + 3 optional disabled). The edit form lets the owner toggle each of the 3 optional fields on/off and edit the space metadata. The slug is auto-generated from the title with a 4-char random suffix on collision (per `data-model.md` §4). A post-create success screen shows the public URL with a copy button and an "open page" link.
- Add an inbox page that lists every testimonial belonging to the user's spaces, with filters (space, rating, visibility, date range, search by name or text, favorite-only). Each card has buttons for favorite, Wall of Love, hide/unhide, edit, and delete; each action persists via a small per-action API route so the UI does not need to know the full PATCH shape.
- Add a public per-space Wall of Love at `/p/[slug]/wall` that renders only `isWallOfLove = true AND visibilityStatus = 'published'` testimonials, ordered `isFavorite DESC, submissionTimestamp DESC`. Never returns `contributorEmail`. The existing `/p/[slug]` page gets a "View our Wall of Love" link when at least one testimonial is on the wall.
- Replace the `?userId=` shim on `/dashboard/billing` and the body of `POST /api/stripe/checkout` with `await auth()` so the billing page and checkout endpoint derive the user from the session. The Stripe webhook handler is unchanged (it stays signature-verified, not session-authenticated).
- Replace the create-next-app placeholder at `/` with a real marketing landing page that links to `/sign-up` and `/sign-in`.
- Add a Prisma seed script that creates two users (one free, one premium) and a handful of spaces and testimonials matching the `data-model.md` §12 sample data walkthrough, so the inbox and Wall of Love have something to show on first boot.

## Capabilities

### New Capabilities

- `auth`: Registers, signs in, and signs out the user. Owns the credentials provider, the `passwordHash` flow, the session cookie, the middleware that gates `/dashboard/*`, and the register / sign-in / sign-up / sign-out pages. Boundary: anything that derives the current `User` from a request.
- `dashboard-spaces`: Lets an authenticated owner create, list, edit, and delete `Space` rows and their `SpaceField` configuration. Owns the dashboard layout, the spaces pages, the spaces API routes, the slug uniqueness rule, and the default-field seeder. Boundary: anything that mutates spaces or the owner's view of them.
- `inbox-and-wall`: Lets the owner triage incoming testimonials (favorite, wall-of-love, hide, edit, delete) and renders the public per-space Wall of Love. Owns the inbox service, the inbox page, the per-action testimonial API routes, the testimonial edit dialog, and the public `/p/[slug]/wall` page. Boundary: anything that touches testimonial visibility flags and the public display derived from them.

### Modified Capabilities

- `data-model`: No edits. The locked data-model spec already covers every invariant this change depends on (slug uniqueness, the 6 `SpaceField.fieldType` closed set, the 1-5 rating range, the `isWallOfLove = true AND visibilityStatus = 'published'` Wall of Love query, the inbox ordering).
- `public-submission`: No edits. The existing public form page and submission endpoint are untouched; this change only adds a "View our Wall of Love" link at the bottom of `/p/[slug]` when the count is greater than zero.

## Impact

- New files (full list in the plan-of-record at `.puku-cli/plans/enumerated-floating-pony.md`):
  - Auth: `lib/auth.ts`, `lib/password.ts`, `lib/validation/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/api/auth/register/route.ts`, `app/(auth)/sign-up/page.tsx`, `app/(auth)/sign-up/SignUpForm.tsx`, `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-in/SignInForm.tsx`, `components/auth/SignOutButton.tsx`, `middleware.ts` (or `proxy.ts`).
  - Dashboard: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `components/dashboard/DashboardShell.tsx`.
  - Spaces: `lib/spaces.ts`, `lib/slug.ts`, `lib/space-defaults.ts`, `lib/validation/space.ts`, `app/dashboard/spaces/page.tsx`, `app/dashboard/spaces/new/page.tsx` + `NewSpaceForm.tsx`, `app/dashboard/spaces/[id]/page.tsx` + `SpaceEditor.tsx`, `app/dashboard/spaces/[id]/created/page.tsx`, `app/api/spaces/route.ts`, `app/api/spaces/[id]/route.ts`.
  - Inbox + Wall: `lib/testimonials.ts`, `lib/validation/inbox.ts`, `app/dashboard/inbox/page.tsx`, `app/dashboard/inbox/InboxList.tsx`, `app/dashboard/inbox/EditTestimonialDialog.tsx`, `app/api/testimonials/[id]/route.ts`, `app/api/testimonials/[id]/favorite/route.ts`, `app/api/testimonials/[id]/wall-of-love/route.ts`, `app/api/testimonials/[id]/visibility/route.ts`, `app/p/[slug]/wall/page.tsx`.
  - Cross-cutting: `components/ui/Button.tsx`, `components/ui/Input.tsx`, `components/ui/Textarea.tsx`, `components/ui/Card.tsx`. `prisma/seed.ts`.
- Modified files:
  - `app/dashboard/billing/page.tsx` — `?userId=` shim replaced with `await auth()`.
  - `components/billing/BillingClient.tsx` — drops the `userId` prop, posts an empty body to the checkout endpoint.
  - `app/api/stripe/checkout/route.ts` — reads `session.user.id` server-side; the body's `userId` is now ignored (kept for forward-compat with pre-filled URLs).
  - `app/p/[slug]/page.tsx` — adds a "View our Wall of Love" link at the bottom when the wall has at least one testimonial.
  - `app/layout.tsx` — real metadata (title, description).
  - `app/page.tsx` — real landing page (sign-up / sign-in CTAs).
  - `package.json` — adds `next-auth@beta`, `bcryptjs`, `@types/bcryptjs`, plus a `prisma.seed` script.
  - `.env.example` — documents `AUTH_SECRET` as `openssl rand -base64 32`.
- Schema: no changes. The schema is already aligned with `data-model.md` and the JWT-only Auth.js path needs no `Account`/`Session` tables.
- The `?userId=` shim is removed; the page becomes a single server-rendered view that derives the user from the session. Old `?userId=` URLs simply ignore the query parameter and render the logged-in user.
- Public surface invariants preserved: `contributorEmail` is never returned by any new endpoint. The Wall of Love filters server-side to `isWallOfLove = true AND visibilityStatus = 'published'`. Plan limits continue to be enforced in `lib/enforce-limits.ts`.
- Out of scope (deferred to a follow-up change): the embeddable widget (PRD §3.7), the dashboard analytics chart (PRD §3.2), confetti animation on submission success, email verification, full-text search, multi-variant embed configs per space.
