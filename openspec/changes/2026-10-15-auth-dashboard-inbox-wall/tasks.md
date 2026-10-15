# Tasks

## 1. OpenSpec artifacts

- [x] 1.1 Create `openspec/changes/2026-10-15-auth-dashboard-inbox-wall/proposal.md` and verify it states the why, the what-changes list, the three new capabilities, the modified-capabilities section (none), and the impact list.
- [x] 1.2 Create `openspec/changes/2026-10-15-auth-dashboard-inbox-wall/design.md` and verify it covers goals, non-goals, the eight decisions (Auth.js v5 + JWT, middleware-vs-proxy, service layer, per-Zod-schemas, URL search params for filters, per-action API routes, server-side wall filter, removing the `?userId=` shim), risks, and migration plan.
- [x] 1.3 Create `openspec/changes/2026-10-15-auth-dashboard-inbox-wall/specs/auth/spec.md` and verify it covers the eight requirements (register, sign-in, sign-out, dashboard gate, public whitelist, session shape, password storage, out-of-scope).
- [x] 1.4 Create `openspec/changes/2026-10-15-auth-dashboard-inbox-wall/specs/dashboard-spaces/spec.md` and verify it covers the eight requirements (layout, index, list, create, edit, delete, post-create success, cross-user isolation, out-of-scope).
- [x] 1.5 Create `openspec/changes/2026-10-15-auth-dashboard-inbox-wall/specs/inbox-and-wall/spec.md` and verify it covers the eleven requirements (inbox list, filters, favorite, wall-of-love, visibility, edit, delete, public wall, link from `/p/<slug>`, cross-user isolation, out-of-scope).
- [x] 1.6 Run `npx openspec validate 2026-10-15-auth-dashboard-inbox-wall --strict` from the project root and verify it exits 0 with no validation errors against proposal, design, tasks, and the three delta specs.

## 2. Install dependencies

- [ ] 2.1 Add `next-auth@beta` to `package.json` dependencies and `npm install`; verify `node_modules/next-auth/package.json` reports a v5 version (e.g. `5.x.x`).
- [ ] 2.2 Add `bcryptjs` to `package.json` dependencies and `@types/bcryptjs` to devDependencies and `npm install`; verify both packages are present in `node_modules`.
- [ ] 2.3 Confirm Auth.js v5's App Router entrypoint by reading `node_modules/next-auth/package.json` "exports" — the catch-all route at `app/api/auth/[...nextauth]/route.ts` re-exports `GET` and `POST` from `lib/auth.ts`.
- [ ] 2.4 Generate a real `AUTH_SECRET` and add it to `.env` (use `openssl rand -base64 32`); document in `.env.example` that the value should be a 32-byte base64 string.

## 3. Auth foundation

- [ ] 3.1 Create `lib/password.ts` exporting `hashPassword(plain)` and `verifyPassword(plain, hash)` around `bcryptjs.hash` (10 rounds) and `bcryptjs.compare`; verify a one-off `tsx`/`ts-node` script hashes and re-verifies a known plaintext.
- [ ] 3.2 Create `lib/validation/auth.ts` exporting `registerSchema` (name 1-120, email valid + ≤ 320, password ≥ 8) and `loginSchema` (email, password); verify `safeParse` rejects `password: "short"` and accepts `password: "longenough"`.
- [ ] 3.3 Create `lib/auth.ts` exporting the `NextAuth({...})` config: `CredentialsProvider` with `authorize` calling `prisma.user.findUnique({where:{email}})` + `verifyPassword`, `session.strategy = "jwt"`, `callbacks.jwt` setting `token.userId = user.id` on sign-in, `callbacks.session` exposing `session.user.id`; verify `npx tsc --noEmit` exits 0.
- [ ] 3.4 Create `app/api/auth/[...nextauth]/route.ts` re-exporting `GET` and `POST` from the v5 entrypoint (typically `import { handlers } from "@/lib/auth"; export const { GET, POST } = handlers;`).
- [ ] 3.5 Create `middleware.ts` at the project root (or `proxy.ts` if Next 16.4's docs prefer that name) that re-exports `auth` as `middleware` and adds a matcher that whitelists `/`, `/p/:path*`, `/api/spaces/:path*/testimonials`, `/api/auth/:path*`, `/api/stripe/webhook`, `/_next/:path*`, and static assets. Verify by reading the file back and confirming the matcher block.

## 4. Auth pages and register API

- [ ] 4.1 Create `app/api/auth/register/route.ts` exporting `POST` that validates the body with `registerSchema`, hashes the password, creates a `User` (catching Prisma `P2002` and returning 409 with `code: "duplicate_email"`), and returns 201 with `{ id, email, name }` (never `passwordHash`); verify a `curl -X POST` with a valid body returns 201 and a duplicate email returns 409.
- [ ] 4.2 Create `app/(auth)/sign-up/page.tsx` (server component that renders a `<SignUpForm />` client island) and `app/(auth)/sign-up/SignUpForm.tsx` (client component that POSTs to `/api/auth/register`, then on 201 calls `signIn("credentials", { email, password, redirect: false })` and `router.push(next || "/dashboard")`); verify a manual browser walk-through registers a new user and lands on `/dashboard`.
- [ ] 4.3 Create `app/(auth)/sign-in/page.tsx` (server component that reads `?next=` from `searchParams`) and `app/(auth)/sign-in/SignInForm.tsx` (client component that calls `signIn("credentials", { email, password, redirect: false })` and on success pushes to `next || "/dashboard"`); verify the post-signin redirect honors `?next=/dashboard/spaces`.
- [ ] 4.4 Create `components/auth/SignOutButton.tsx` (client form that POSTs to the Auth.js sign-out endpoint, then `router.push("/")`); mount it in the dashboard layout's top bar (created in task 6.1).

## 5. Convert billing to session auth

- [ ] 5.1 Edit `app/dashboard/billing/page.tsx`: replace the `?userId=` shim with `await auth()`; on missing session, redirect to `/sign-in?next=/dashboard/billing`; use `session.user.id` to load the user, subscription, and space usage. Verify the page now 404s a `?userId=<other-id>` URL because the param is ignored and the session user is loaded instead.
- [ ] 5.2 Edit `components/billing/BillingClient.tsx`: drop the `userId` prop; POST an empty body to `/api/stripe/checkout`; the success page redirect still works because the server now derives the user from the session.
- [ ] 5.3 Edit `app/api/stripe/checkout/route.ts`: read `session.user.id` from `auth()` at the top; reject 401 when no session; ignore any `userId` in the body (still parse it for forward-compat with prefilled URLs). Verify an unauthenticated `curl -X POST` returns 401.

## 6. Dashboard layout and index

- [ ] 6.1 Create `app/dashboard/layout.tsx` as a server component that calls `await auth()`, redirects to `/sign-in?next=<current>` on missing session, and renders a `<DashboardShell user={...}>` wrapping `{children}`. Create `components/dashboard/DashboardShell.tsx` rendering the top bar (user's name, sign-out button) and a max-width container.
- [ ] 6.2 Create `app/dashboard/page.tsx` (server) that loads owned spaces with `_count.testimonials`, recent 10 testimonials across all owned spaces, total testimonial count, average rating (when at least one space has `ratingEnabled = true` else "N/A"), the current plan, and the plan limits; render a usage bar per `BillingClient`'s pattern and a recent-activity list.
- [ ] 6.3 Verify a manual walk-through of `/dashboard` after sign-in shows the user's name, the spaces count, the testimonial count, the plan, and the recent activity.

## 7. Spaces CRUD

- [ ] 7.1 Create `lib/validation/space.ts` exporting `createSpaceSchema` and `updateSpaceSchema` (same shape; title 1-120, subtitle 0-200, prompt 1-2000, theme `light|dark`, ratingEnabled boolean, publicSlug regex `^[a-z0-9-]+$` 3-60, enabledFields optional `{companyName, socialLinks, profilePhoto}` booleans).
- [ ] 7.2 Create `lib/slug.ts` exporting `slugify(title)` (kebab-case, ASCII only) and `ensureUniqueSlug(base, prisma)` that probes Prisma and appends a 4-char random base36 suffix on collision (up to 5 retries before bubbling the error).
- [ ] 7.3 Create `lib/space-defaults.ts` exporting `seedDefaultFields(spaceId, prisma)` that creates the 6 default `SpaceField` rows (3 core always required + 3 optional disabled) inside the supplied transaction client.
- [ ] 7.4 Create `lib/spaces.ts` exporting `createSpace(userId, input)`, `updateSpace(userId, spaceId, input)`, `deleteSpace(userId, spaceId)`, `getOwnedSpace(userId, spaceId)`, `listOwnedSpaces(userId)`. All derive ownership from the session-supplied `userId` and never from the request body. `createSpace` calls `assertCanCreateSpace(userId)` and runs the slug-uniqueness probe and field seeding inside a single `prisma.$transaction(...)`.
- [ ] 7.5 Create `app/api/spaces/route.ts` exporting `POST` (validate, call `createSpace`, map `PlanLimitError` to 403) and `GET` (call `listOwnedSpaces`, return 200 with the array). Verify a `curl -X POST` with a valid body returns 201 with `{ id, publicSlug }` and a duplicate `publicSlug` body gets the suffix in the response.
- [ ] 7.6 Create `app/api/spaces/[id]/route.ts` exporting `GET`, `PATCH`, `DELETE`. Each calls the corresponding service function and maps a not-found result to 404. Verify cross-user access (`<userA-token>` GETting `<userB-space-id>`) returns 404.
- [ ] 7.7 Create `app/dashboard/spaces/page.tsx` (server, renders the list with action buttons) and `components/dashboard/SpaceList.tsx` (client island for the delete button's confirm-and-fetch flow with `router.refresh()` on success).
- [ ] 7.8 Create `app/dashboard/spaces/new/page.tsx` and `app/dashboard/spaces/new/NewSpaceForm.tsx` (client form that POSTs to `/api/spaces` and on 201 navigates to `/dashboard/spaces/<id>/created`).
- [ ] 7.9 Create `app/dashboard/spaces/[id]/page.tsx` (server, loads the space + fields + recent testimonials) and `app/dashboard/spaces/[id]/SpaceEditor.tsx` (client form for title/subtitle/prompt/theme/ratingEnabled/optional field toggles; PATCHes `/api/spaces/[id]`; has a delete button at the bottom with `confirm()` calling `DELETE /api/spaces/[id]` then `router.push("/dashboard/spaces")`).
- [ ] 7.10 Create `app/dashboard/spaces/[id]/created/page.tsx` showing the public URL with a copy button (`navigator.clipboard.writeText`), an "Open page" link with `target="_blank"`, and a "Back to dashboard" link.
- [ ] 7.11 Verify a manual walk-through: sign in as a fresh user, click "+ New space", create "Product Hunt reviews" with Company on, land on the success page, open the public URL in a new tab, see the form. From the spaces list, edit the title, see the public URL slug change, delete the space, see the list shrink.

## 8. Inbox

- [ ] 8.1 Create `lib/validation/inbox.ts` exporting `inboxFilterSchema` (spaceId, rating, visibility, fromDate, toDate, q, favorite; all optional) and `editTestimonialSchema` (contributorName 1-200, contributorEmail valid + ≤ 320, testimonialText 1-5000, rating optional 1-5, additionalValues shape).
- [ ] 8.2 Create `lib/testimonials.ts` exporting `listInbox(userId, filters)`, `getOwnedTestimonial(userId, id)`, `setFavorite(userId, id, value)`, `setWallOfLove(userId, id, value)`, `setVisibility(userId, id, value)`, `updateTestimonial(userId, id, input)`, `deleteTestimonial(userId, id)`. Each derives ownership from `Space.ownerId = session.user.id`; a cross-user call returns `null` and the route handler maps that to 404.
- [ ] 8.3 Create `app/api/testimonials/[id]/route.ts` exporting `GET`, `PATCH`, `DELETE` that call the service functions. Verify cross-user access returns 404.
- [ ] 8.4 Create `app/api/testimonials/[id]/favorite/route.ts`, `.../wall-of-love/route.ts`, and `.../visibility/route.ts` exporting `POST` that each call the corresponding service function and return 200. Verify cross-user access returns 404.
- [ ] 8.5 Create `app/dashboard/inbox/page.tsx` (server, reads `searchParams`, parses with `inboxFilterSchema`, calls `listInbox`, renders the filter form and the list) and `app/dashboard/inbox/InboxList.tsx` (client island rendering the cards with action buttons that fetch the per-action routes and call `router.refresh()` on success).
- [ ] 8.6 Create `app/dashboard/inbox/EditTestimonialDialog.tsx` (client modal with the testimonial's current values; on submit, PATCHes `/api/testimonials/[id]` and calls `router.refresh()`).
- [ ] 8.7 Verify a manual walk-through: as the owner of a space with 2 testimonials (one favorited, one not), open the inbox, see the favorite first, click the favorite button on the second to promote it, see the order swap without a full reload, click hide, see the testimonial disappear from the default view, re-show it via `?visibility=hidden` filter, edit a testimonial's text, delete one, see the list shrink.

## 9. Public Wall of Love

- [ ] 9.1 Create `app/p/[slug]/wall/page.tsx` (server component) that resolves the `Space` by `publicSlug` (404 on miss), loads the testimonials where `isWallOfLove = true AND visibilityStatus = 'published'` ordered `isFavorite DESC, submissionTimestamp DESC`, and renders each card with contributor name, optional `additionalValues.companyName`, testimonial text, and rating (only when `Space.ratingEnabled`). The response and the rendered HTML never include `contributorEmail`.
- [ ] 9.2 Edit `app/p/[slug]/page.tsx` to add a "View our Wall of Love" link at the bottom of the page when the wall count is greater than zero (single extra `count` query in the same page load).
- [ ] 9.3 Verify a manual walk-through: as the owner of a space, mark a testimonial as wall-of-love, open `/p/<slug>/wall` in an incognito window, see the testimonial; unmark wall-of-love, refresh, see it disappear; hide it via the inbox, refresh, see it disappear.

## 10. Replace root landing and update metadata

- [ ] 10.1 Replace `app/page.tsx` with a real landing page (title, subtitle, two CTAs: "Get started" linking to `/sign-up` and "Sign in" linking to `/sign-in`). Match the Tailwind style of the other pages.
- [ ] 10.2 Update `app/layout.tsx` `metadata.title` to "Testimonial SaaS" and `metadata.description` to a real product description.

## 11. Seed data

- [ ] 11.1 Create `prisma/seed.ts` exporting a default `async function main()` that creates the two users (`alice@example.com` / `password123`, free; `bob@example.com` / `password123`, premium), the four spaces and six `SpaceField` rows per space matching `data-model.md` §12, and the seven testimonials with the visibility flags from the same table. Use `bcryptjs.hash` for the passwords.
- [ ] 11.2 Add a `prisma.seed` script to `package.json` pointing at the seed file (TypeScript-aware: `tsx prisma/seed.ts`). Add `tsx` as a devDependency.
- [ ] 11.3 Run `npx prisma migrate reset --force` followed by `npx prisma db seed` and verify the dev DB is populated; run `npx tsc --noEmit` to confirm the seed type-checks.

## 12. End-to-end smoke verification

- [ ] 12.1 Run `npx tsc --noEmit` and verify it exits 0.
- [ ] 12.2 Run `npx next build` and verify it exits 0 (catches App Router mistakes that dev tolerates).
- [ ] 12.3 Run `npx eslint .` and verify it exits 0.
- [ ] 12.4 Run `npx openspec validate 2026-10-15-auth-dashboard-inbox-wall --strict` and verify it exits 0.
- [ ] 12.5 Start `npm run dev` and walk the full happy path: sign up as `carol@example.com` / `password123` → land on `/dashboard` → create a space titled "Loved by Carol" → land on the success page → open the public URL in a new tab → submit a testimonial → back in `/dashboard`, the new testimonial appears in the recent activity list → `/dashboard/inbox` shows the testimonial → mark it as wall-of-love → open `/p/loved-by-carol/wall` in an incognito window, see the testimonial → sign out → try `/dashboard`, get bounced to `/sign-in?next=/dashboard`.
- [ ] 12.6 Cross-user isolation: sign up as `mallory@example.com` / `password123`. Via the dev tools network tab, `GET /api/spaces/<carol-space-id>` → 404. `GET /api/testimonials/<carol-testimonial-id>` → 404. `POST /api/testimonials/<carol-testimonial-id>/favorite` with `mallory`'s cookie → 404. `curl -X POST http://localhost:3000/api/testimonials/<carol-testimonial-id>/favorite` without a cookie → 401.
- [ ] 12.7 `git status` shows no committed secrets (`.env` is gitignored; the new code reads only `process.env.AUTH_SECRET` etc.).
