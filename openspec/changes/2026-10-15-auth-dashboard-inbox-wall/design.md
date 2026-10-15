# Design

## Context

The data model, public submission surface, plan-limit enforcement, and Stripe billing webhook are all in place and locked behind two archived OpenSpec changes. The owner-side product is missing: there is no authentication, no dashboard, no inbox, and no public Wall of Love. The existing `/dashboard/billing` page identifies the user via a `?userId=` query string and flags a `TODO` to replace it with real auth.

The MVP is unblockable in this state: a new owner cannot sign up, cannot create a space, cannot see incoming testimonials, and cannot curate the Wall of Love. The next change has to deliver all three of (auth, dashboard spaces CRUD, inbox + Wall of Love) before the embed widget or any other owner-facing feature is worth building.

Two architectural questions pre-decided by the user before this change: the auth library is Auth.js v5 with the credentials provider, and the Wall of Love lives at the per-space route `/p/[slug]/wall` (not a per-user aggregate). The field-configuration UX is "auto-seed the 6 default `SpaceField` rows on create; the edit page lets the owner toggle each of the 3 optional fields on/off".

## Goals / Non-Goals

**Goals:**
- One OpenSpec change with three delta specs (`auth`, `dashboard-spaces`, `inbox-and-wall`); each spec owns its own boundary so a future change can extend one without touching the others.
- Server-side ownership enforcement at every mutating endpoint. The `userId` / `spaceId` / `testimonialId` always comes from the session or from a slug that has been resolved against the session; the request body is never the source of truth for "who is this for".
- Reuse the existing service-layer functions (`assertCanCreateSpace`, `getLimitsForPlan`, `isPremium`, the shared `prisma` client) rather than re-implementing the rules.
- `contributorEmail` stays private: never returned by any new endpoint, never rendered on any new page.
- The billing page becomes the canary for the auth wiring — once it reads from the session instead of `?userId=`, every other `/dashboard/*` page inherits the same pattern.

**Non-Goals:**
- No embeddable widget (PRD §3.7) and no analytics chart (PRD §3.2) — both deferred to a follow-up change.
- No email verification on sign-up (deferred per `data-model.md` §14).
- No password reset, no "remember me" toggles, no social providers — credentials-only for MVP.
- No drag-and-drop testimonial reordering, no per-testimonial display order, no FTS in the inbox search.
- No multi-variant embed configs per space (the `@@unique([spaceId])` already enforces 1:1).
- No confetti animation on submission success (the existing "Thank you" state stands).
- No new schema migration. The schema is already aligned with the data-model spec; Auth.js v5's JWT path needs no `Account`/`Session` tables.

## Decisions

### 1. Auth.js v5 with the credentials provider and a JWT session strategy
The `User` table is auth-ready (`passwordHash` is in the schema, no `Account`/`Session`/`VerificationToken` tables are defined). A JWT session strategy keeps the auth path stateless and SQLite/Postgres-portable: a single `prisma.user.findUnique({where:{email}})` plus `bcrypt.compare` validates the credentials, the resulting token carries the `userId` for the cookie's lifetime, and there is nothing to clean up on logout other than clearing the cookie. Trade-off: revoking an active session is not possible without rotating `AUTH_SECRET`. Accepted for MVP — there is no admin "kick user" surface in scope. The catch-all route at `app/api/auth/[...nextauth]/route.ts` re-exports `GET` and `POST` from `lib/auth.ts`, matching the v5 App Router pattern.

### 2. Middleware vs. `proxy.ts` — follow what Next 16.4 ships
The PRD's `AGENTS.md` flags that Next 16.4 has breaking changes vs. training-data Next.js. Middleware-vs-proxy is one of the renamed file conventions. The middleware-vs-proxy decision is made on first run by reading `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` and `proxy.md`; whichever one is current is used. Both files have identical semantics for our use case (matcher-based gating of `/dashboard/*` and `/account/*`).

### 3. Service layer for spaces, not a fat route handler
Spaces CRUD has a lot of moving parts (slug uniqueness, default-field seeding, plan-limit gating, slug-edit conflict resolution, ownership checks on PATCH/DELETE). Putting all of that in the route handler would make the route file long and hard to test. Instead, `lib/spaces.ts` owns the service-layer functions (`createSpace`, `updateSpace`, `deleteSpace`, `getOwnedSpace`), each of which:
  - takes the session-derived `userId` and the `spaceId` (when applicable);
  - re-derives ownership from the database, never from the URL parameter alone;
  - calls `assertCanCreateSpace` for the create path;
  - runs the slug-uniqueness probe and appends a 4-char suffix on collision;
  - seeds the 6 default `SpaceField` rows inside the same transaction.

The route handler becomes a thin Zod-validate → call service → map typed errors to HTTP status.

### 4. Single Zod schema for each new boundary, no shared "form schema"
The public submission schema in `lib/validation/testimonial-submission.ts` is reused unchanged. New boundaries get their own Zod schemas (`auth.ts`, `space.ts`, `inbox.ts`) co-located with their consumers. The schemas are the *single source of truth* for the request body shape — the client component and the route handler both import the same `*Schema` and `.safeParse` against it.

### 5. Inbox uses URL search params for filter state
The inbox page is a server component that reads `?spaceId=&rating=&visibility=&fromDate=&toDate=&q=&favorite=` from `searchParams` and passes the parsed filter to the service. The filter form is a client island that submits via `router.push(...)` on change, so every filter state has a deep-linkable URL. Trade-off: a round trip on every filter change. Accepted because the inbox is the owner's own data, low-volume, and the per-space composite indexes already cover the queries.

### 6. Per-action API routes for inbox actions instead of one PATCH
The inbox UI has five different actions (favorite, wall-of-love, hide/unhide, edit, delete). Modeling them as one `PATCH /api/testimonials/[id]` with a discriminated union works, but it forces the client to know the full update shape. Modeling them as five small routes (`POST /api/testimonials/[id]/favorite`, `…/wall-of-love`, `…/visibility`, `PATCH …` for full edit, `DELETE …`) keeps each handler under 30 lines and means the inbox's action buttons can be wired without a single `useReducer` or form-state hook. Each route derives ownership from `Space.ownerId = session.user.id` and returns 404 on cross-user access.

### 7. Public Wall of Love filters server-side, no client-side filtering
`/p/[slug]/wall` is a server component that does the equivalent of the locked data-model query: `WHERE spaceId = <id> AND isWallOfLove = true AND visibilityStatus = 'published'`, ordered `isFavorite DESC, submissionTimestamp DESC`. No `contributorEmail`, no `isFavorite` (the ordering is the only thing the field controls). The `additionalValues.companyName` is rendered when present, but `socialLinks` and `profilePhoto` are omitted in MVP — they are part of the schema but the spec doesn't require them on the public wall surface yet (and exposing `socialLinks` URLs would need a small URL-sanitization step that is out of scope for this change). The rating is rendered only when `Space.ratingEnabled` is true.

### 8. The `?userId=` shim is removed, not kept behind a flag
The shim was a TODO marker. The change deletes the query-string branch in `/dashboard/billing/page.tsx` and replaces it with a session read. Old URLs with `?userId=...` simply render the logged-in user — the param is ignored. This is acceptable because the page is owner-only and the only consumers of the URL are the owner themselves; we are not breaking a public link contract.

## Risks / Trade-offs

- [Next 16.4's middleware-vs-proxy rename] → Mitigation: read the local docs on first run; the rest of the change is file-agnostic.
- [JWT sessions cannot be revoked server-side without rotating `AUTH_SECRET`] → Mitigation: documented; out of scope for MVP. The session lifetime is bounded by NextAuth's default (30 days, sliding).
- [Service-layer functions own the slug-uniqueness probe, but Prisma's `@@unique` is the safety net] → Mitigation: the service retries up to a small fixed number of times on `P2002` before bubbling the error; collisions are 1-in-a-million because the suffix is 4 random base36 chars.
- [Per-action API routes multiply the endpoint count] → Mitigation: each route is a 15-line handler; the alternative (a single PATCH with a discriminated union) is the same line count pushed into the client and harder to test.
- [Filter state on the inbox lives in the URL] → Mitigation: filter inputs are uncontrolled and submit-on-change, so a back-button works correctly. We don't need a separate `/dashboard/inbox/filter` deep-link surface.
- [Auth.js v5's `next-auth@beta` tag is the current stable in the App Router era] → Mitigation: pinned to `beta`; if the stable release lands before the change is merged, the migration is a `npm i next-auth@latest` plus reading the v5 changelog.
- [`bcryptjs` is pure JavaScript and slower than native `bcrypt`] → Mitigation: 10 rounds is fast enough (~50ms) and avoids the native-build step that breaks Windows installs.
- [The default-field seeder and the create-space transaction are coupled] → Mitigation: the seeding happens inside the same `prisma.$transaction(...)` as the space create, so a failed seed rolls back the space create.
- [Public Wall of Love renders the full result set in one server pass] → Mitigation: per-plan caps (100 free / 1000 premium) make this safe; pagination is a v2.

## Migration Plan

- Additive change, no schema migration.
- Deploy order is independent of feature surface; the new files do not require a coordinated release. The single breaking change is the removal of the `?userId=` query-string branch on `/dashboard/billing` — the page now reads the session and ignores the param. Old URLs with the param still render the logged-in user correctly (the param is silently dropped).
- Rollback: remove the new directories and revert the three modified files. The dev SQLite database is untouched.

## Open Questions

(none — every design choice that would have affected the spec or the task breakdown is resolved above. The middleware-vs-proxy file-name question is resolved at implementation time by reading the local Next 16.4 docs.)
