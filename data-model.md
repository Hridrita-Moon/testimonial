# Data Model — Testimonial SaaS MVP

This document is the agreed data model for the Testimonial SaaS MVP, derived from `PRD.md` and a 10-question design interview. All decisions are explicit and traceable.

The schema is implemented in `prisma/schema.prisma`. This file documents the **intent** behind each table, column, and index, and the call-site decisions that shape them.

---

## 1. Stack assumptions

- **Database:** PostgreSQL in production. SQLite is used in dev only (per `.env.example`).
- **ORM:** Prisma 6.19+ (`@prisma/client`).
- **Money, counts, and limit checks** are computed in TypeScript, not in DB constraints (see §7).
- **All `Json` columns** map to PostgreSQL `jsonb` in production and `JSON` in SQLite dev.

---

## 2. Entity overview

| Entity | Purpose | PRD § |
|---|---|---|
| `User` | Account owner. | §3.1, §5 |
| `Space` | A single testimonial collection page. | §3.3, §5 |
| `SpaceField` | Per-space form-field configuration. | §3.3, §5 |
| `Testimonial` | A single submission against a Space. | §3.4, §5 |
| `Subscription` | One row per user; current billing state. | §3.8, §5 |
| `EmbedConfiguration` | Per-space widget settings. | §3.7, §5 |

---

## 3. `User`

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `name` | `String` | |
| `email` | `String @unique` | Login id. Indexed by `@@unique`. |
| `passwordHash` | `String` | Server-only. Never returned by APIs. |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Relations:**
- `spaces Space[]` — owned spaces.
- `subscriptions Subscription[]` — billing records (one row, but relation is 1:N for forward-compat).

**Auth (deferred):** the `User` table is auth-ready (`passwordHash` is present) but no auth library is wired up yet. See "Open work" in §10.

---

## 4. `Space`

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `ownerId` | `String` | FK → `User.id`, `onDelete: Cascade`. |
| `title` | `String` | Required. |
| `subtitle` | `String?` | Optional. |
| `prompt` | `String` | The question shown to contributors. |
| `theme` | `String @default("light")` | Predefined visual theme. |
| `ratingEnabled` | `Boolean @default(true)` | Single on/off toggle; not a per-field config. |
| `publicSlug` | `String @unique` | Unique, kebab-case, user-editable with random suffix on conflict. |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Indexes:**
- `@@unique([publicSlug])` (already present in current schema).

**Slug rules** (confirmed in interview Q1):
- Auto-generated from `title` (kebab-case).
- User can edit the slug in the UI; server validates uniqueness.
- On collision, server appends a 4-char random suffix (`q4-launch-m3p9`).
- The slug is the **only** authorization for public submission endpoints (Q4). Rate limiting at the edge is the abuse protection; tokens / CAPTCHAs are deferred to v2.

**`ratingEnabled` vs `SpaceField` (Q2):** rating is a single boolean on `Space`, not a row in `SpaceField`. This keeps form-field rows limited to the 6 enumerated types: `name`, `email`, `testimonialText`, `companyName`, `socialLinks`, `profilePhoto`.

**Relations:**
- `owner User` — back-ref to owner.
- `fields SpaceField[]` — form-field config.
- `testimonials Testimonial[]` — submissions.
- `embedConfigurations EmbedConfiguration[]` — widget settings (1:1 in practice, see §8).

---

## 5. `SpaceField`

Per-space form-field configuration. One row per enabled/disabled field per space (Q2: Option A).

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `spaceId` | `String` | FK → `Space.id`, `onDelete: Cascade`. |
| `fieldType` | `String` | Enum-like: `name`, `email`, `testimonialText`, `companyName`, `socialLinks`, `profilePhoto`. |
| `label` | `String` | Display label ("Your name", "Company", etc.). |
| `enabled` | `Boolean @default(true)` | If false, field is hidden on the public form. |
| `required` | `Boolean @default(false)` | If true, submission fails without it. |
| `displayOrder` | `Int @default(0)` | Form rendering order. |

**Invariants:**
- `name` and `email` are always required and enabled. The UI prevents disabling them; the server enforces on submit.
- `testimonialText` is always required and enabled.
- `rating` is **not** stored here — it's a boolean on `Space`.

**Indexes (recommended):**
- `@@index([spaceId, displayOrder])` — load form config in render order.

---

## 6. `Testimonial`

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `spaceId` | `String` | FK → `Space.id`, `onDelete: Cascade`. |
| `contributorName` | `String` | |
| `contributorEmail` | `String` | |
| `testimonialText` | `String` | The main testimonial body. |
| `rating` | `Int?` | 1–5, nullable when `Space.ratingEnabled = false`. |
| `additionalValues` | `Json?` | `{ companyName?, socialLinks?, profilePhoto? }`. |
| `socialConsent` | `Boolean @default(false)` | Permission to share on social media. |
| `isFavorite` | `Boolean @default(false)` | Floats to top in ordering. |
| `isWallOfLove` | `Boolean @default(false)` | Visible on the public Wall of Love. |
| `visibilityStatus` | `String @default("published")` | `published` \| `hidden`. |
| `submissionTimestamp` | `DateTime @default(now())` | Server-set. |

**Confirmed in Q3:**
- Storage shape = columns for core + JSON for extras (Q3: Option A).
- Rating 1–5.
- `visibilityStatus` ∈ `{ published, hidden }`. Other statuses (`spam`, `archived`) deferred to v2.

**Confirmed in Q5:**
- No `displayOrder` column. Inbox ordering is computed: `isFavorite DESC, submissionTimestamp DESC`.
- Search uses `LIKE '%term%'` on `contributorName` and `testimonialText`. FTS is deferred to v2.
- Public Wall of Love query: `WHERE isWallOfLove = true AND visibilityStatus = 'published'`.

**Indexes:**
- `@@index([spaceId, submissionTimestamp])` — chart and inbox list queries.
- `@@index([spaceId, isWallOfLove, visibilityStatus])` — public Wall of Love fetch by embed.

**Constraints:**
- App-layer: `rating` must be 1–5 if present; `testimonialText` non-empty; `contributorEmail` valid format.

---

## 7. `Subscription`

One row per user. Status reflects the current state, updated in place by the Stripe webhook (Q6 + Q8: Option A).

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `userId` | `String` | FK → `User.id`, `onDelete: Cascade`. **Unique per user.** |
| `plan` | `String @default("free")` | `free` \| `premium`. Forward-compat for future plans. |
| `status` | `String @default("active")` | `active` \| `past_due` \| `cancelled` \| `incomplete` \| `paused` \| `unpaid`. |
| `stripeCustomerId` | `String?` | Identifies the user in Stripe. Persists across re-subscriptions. |
| `stripeSubscriptionId` | `String?` | Identifies the **current** Stripe sub. Changes on re-subscribe. |
| `currentBillingPeriod` | `DateTime?` | End of current paid period. |
| `cancelAtPeriodEnd` | `Boolean @default(false)` | User cancelled but still entitled until `currentBillingPeriod`. |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Indexes / constraints:**
- `@@unique([userId])` — at most one Subscription row per user. This is the **change** vs. the current schema and prevents webhook retries from creating duplicates.

**State machine (applied by `/api/stripe/webhook`):**

| Stripe event | `plan` | `status` | `cancelAtPeriodEnd` |
|---|---|---|---|
| (no row) | `free` | `active` | `false` |
| `customer.subscription.created` (active/trialing) | `premium` | `active` | `false` |
| `customer.subscription.updated` → active/trialing | `premium` | `active` | (mirror Stripe) |
| `customer.subscription.updated` → past_due/unpaid | `premium` | `past_due` | (mirror Stripe) |
| `customer.subscription.updated` → canceled (immediate) | `free` | `cancelled` | `true` |
| `customer.subscription.deleted` | `free` | `cancelled` | `true` |
| `invoice.payment_failed` | (unchanged) | `past_due` | (unchanged) |

**Idempotency:** the webhook uses `findUnique by userId` + update (or create if missing) inside a transaction. The `@@unique([userId])` constraint is the safety net.

**Re-subscription (Q8):** when a user re-subscribes after cancelling, the same row flips back to `plan=premium, status=active`. `stripeSubscriptionId` is updated to the new sub id; `stripeCustomerId` stays the same.

---

## 8. `EmbedConfiguration`

Per-space widget settings. 1:1 in practice, with `@@unique([spaceId])` to enforce it (Q7: Option A).

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | **This id is what the embed JS snippet references** (Q7 option i). |
| `spaceId` | `String` | FK → `Space.id`, `onDelete: Cascade`. **Unique.** |
| `layout` | `String @default("grid")` | `grid` \| `masonry` \| `carousel`. |
| `themeMode` | `String @default("light")` | `light` \| `dark`. |
| `backgroundColor` | `String @default("#ffffff")` | CSS color. Presets + custom. |
| `settings` | `Json?` | Forward-compat: per-embed toggles like `{ "showCompany": false, "maxItems": 12 }`. |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Indexes / constraints:**
- `@@unique([spaceId])` — at most one embed config per space. (This is a **change** vs. the current schema.)

**Public API contract:**
- The embed JS snippet loads from `/api/embed/[embedConfigId]/testimonials`.
- The response is filtered server-side: `visibilityStatus = 'published'` only.
- The response never includes `contributorEmail` (private), `isFavorite`, or other owners' spaces.

---

## 9. Authorization model

| Action | Auth requirement | Where enforced |
|---|---|---|
| Register / login | Self | `lib/auth/*` (deferred) |
| Create / edit / delete own `Space` | Owner of `Space` | Server route handler. |
| Read own dashboard | Authenticated `User` | Middleware + page-level check. |
| Read inbox | Owner of the underlying `Space` | Server route handler. |
| Edit / delete / favorite / wall-of-love a `Testimonial` | Owner of the underlying `Space` | Server route handler. |
| Public submit | Anyone with valid `publicSlug` | `POST /api/spaces/[slug]/testimonials`. |
| Public Wall of Love | Anyone | `GET /p/[slug]/wall`. |
| Public embed | Anyone | `GET /api/embed/[embedConfigId]/testimonials`. |
| Read own `Subscription` | Self | Dashboard / billing page. |
| Read another user's data | Never | DB queries are always scoped by `ownerId`. |

**Defense in depth:**
- API routes do not trust client-supplied ids. They derive ownership from the authenticated user, not from request bodies.
- `contributorEmail` is never returned by public endpoints.
- The dashboard's `?userId=` shim (current code) is a temporary scaffold until auth lands. Marked with `TODO`.

---

## 10. Plan limits & enforcement

**Plan table** (in code, `lib/plan-limits.ts`):

| Plan | Max spaces | Max testimonials per space | Price |
|---|---|---|---|
| `free` | 3 | 100 | $0 |
| `premium` | 25 | 1,000 | $99/month (configurable via env) |

**Enforcement location (Q9: Option A):** service-layer checks in `lib/enforce-limits.ts`, called from each mutation route.

| Action | Check | HTTP status on reject |
|---|---|---|
| Create space (dashboard) | `assertCanCreateSpace(userId)` | `403` |
| Edit space (no new usage) | none | — |
| Delete space / testimonial (frees usage) | none | — |
| Public submit testimonial | `assertCanSubmitTestimonial(spaceId)` | `422` |
| Upgrade / cancel (no new usage) | none | — |

**Over-limit after downgrade:** the PRD says preserve data, prevent new actions. We do not auto-delete. The check is "is `currentCount >= limit` after this action would land?", not "is current count over?". A Premium user with 10 spaces who downgrades to Free (3 max) can read, edit, and delete; they cannot create.

**Limits must be configurable, not hardcoded** (PRD §3.8). Today: `PLAN_LIMITS` constant + `getPremiumPriceDisplay()` reads `NEXT_PUBLIC_PREMIUM_PRICE_DISPLAY`. Future: load from a `Plan` table or remote config — same call sites, no UI changes.

---

## 11. Public submission endpoint contract

`POST /api/spaces/[slug]/testimonials`

**Authorization:** the slug is the credential. Rate-limited at the edge (Q4: Option A + rate limit).

**Request body:**

```json
{
  "contributorName": "Jane Smith",
  "contributorEmail": "jane@acme.com",
  "testimonialText": "Loved the onboarding!",
  "rating": 5,
  "additionalValues": {
    "companyName": "ACME",
    "socialLinks": "@jane",
    "profilePhoto": "<url or id>"
  },
  "socialConsent": true
}
```

**Server validation (Q4 confirmed):**
- Resolve `Space` by `publicSlug`. 404 if missing.
- Re-validate every field against the space's `SpaceField` config (`enabled`, `required`).
- If `Space.ratingEnabled = false`, ignore any `rating` in the body.
- Call `assertCanSubmitTestimonial(spaceId)`. 422 on rejection.
- Persist. Return 201 with `{ id }`.

**Abuse protection (Q4):** per-IP, per-space sliding-window rate limit. Captcha / token rotation deferred to v2.

---

## 12. Sample data walkthrough

Two users, each with two spaces and several testimonials. All names invented.

### Users

| id | name | email | plan | status |
|---|---|---|---|---|
| `u_alice` | Alice Chen | alice@example.com | free | active |
| `u_bob` | Bob Martinez | bob@acme.com | premium | active |

### Spaces

| id | ownerId | title | slug | ratingEnabled | theme |
|---|---|---|---|---|---|
| `sp_alice_ph` | u_alice | "Product Hunt reviews" | `product-hunt-reviews` | true | light |
| `sp_alice_conf` | u_alice | "Conference feedback" | `conference-feedback` | true | light |
| `sp_bob_acme` | u_bob | "ACME Reviews" | `acme-reviews` | true | light |
| `sp_bob_beta` | u_bob | "Beta testers" | `beta-testers` | true | light |

### SpaceField rows (Alice's PH space)

| fieldType | label | enabled | required | displayOrder |
|---|---|---|---|---|
| `name` | Your name | true | true | 1 |
| `email` | Email | true | true | 2 |
| `testimonialText` | Your testimonial | true | true | 3 |
| `companyName` | Company | true | false | 4 |
| `socialLinks` | Social profiles | false | false | 5 |
| `profilePhoto` | Photo | false | false | 6 |

### Testimonials

| id | space | name | email | text | rating | additionalValues | consent | fav | WoL | visibility |
|---|---|---|---|---|---|---|---|---|---|---|
| `t1` | sp_alice_ph | Jane Smith | jane@acme.com | "Loved the onboarding!" | 5 | `{companyName:"ACME"}` | true | true | true | published |
| `t2` | sp_alice_ph | Carlos Ruiz | carlos@dev.io | "Great DX, but docs could improve." | 4 | `{companyName:"DevCo"}` | false | false | false | published |
| `t3` | sp_alice_ph | Hidden User | anon@example.com | "Spam content here." | 1 | `{}` | false | false | false | **hidden** |
| `t4` | sp_alice_conf | Sam Lee | sam@bigco.com | "Best conf of 2026" | 5 | `{}` | true | true | false | published |
| `t5` | sp_alice_conf | Lin Park | lin@indie.dev | "Too crowded" | 2 | `{}` | false | false | false | published |
| `t6` | sp_bob_acme | Real Customer 1 | r1@acme.com | "Five stars." | 5 | `{companyName:"ACME"}` | true | false | true | published |
| `t7` | sp_bob_beta | Real Beta User | beta@x.com | "Solid v0.4." | 4 | `{}` | true | false | false | published |

### Subscriptions

| userId | plan | status | stripeCustomerId | stripeSubscriptionId | currentBillingPeriod | cancelAtPeriodEnd |
|---|---|---|---|---|---|---|
| `u_alice` | `free` | `active` | — | — | — | false |
| `u_bob` | `premium` | `active` | `cus_AAA` | `sub_222` | 2026-11-14 | false |

### EmbedConfigurations

| spaceId | layout | themeMode | backgroundColor | settings |
|---|---|---|---|---|
| `sp_alice_ph` | `grid` | `light` | `#ffffff` | `{}` |
| `sp_alice_conf` | `carousel` | `dark` | `#0a0a0a` | `{"showCompany": false}` |
| `sp_bob_acme` | `masonry` | `light` | `#f5f5f5` | `{}` |
| `sp_bob_beta` | (no embed yet) | | | |

### Inbox view (Alice, default ordering: favorite DESC, then submissionTimestamp DESC)

| # | text | space | rating | fav | submitted |
|---|---|---|---|---|---|
| 1 | "Best conf of 2026" | Conf feedback | 5 | ✅ | 2026-10-05 |
| 2 | "Loved the onboarding!" | PH reviews | 5 | ✅ | 2026-10-01 |
| 3 | "Too crowded" | Conf feedback | 2 | ❌ | 2026-10-06 |
| 4 | "Great DX…" | PH reviews | 4 | ❌ | 2026-10-03 |
| 5 | (hidden row, not shown by default) | PH reviews | 1 | ❌ | 2026-10-04 |

### Public Wall of Love (Alice's PH space, `/p/product-hunt-reviews/wall`)

| # | text | name | rating |
|---|---|---|---|
| 1 | "Loved the onboarding!" | Jane Smith | 5 ★ |
| 2 | "Great DX, but docs could improve." | Carlos Ruiz | 4 ★ |

`t3` (hidden) and `t4`/`t5` (different space) are excluded.

### Embed fetch (Bob's ACME embed)

`GET /api/embed/<embedConfigId>/testimonials` returns only:

```json
[
  {
    "id": "t6",
    "contributorName": "Real Customer 1",
    "testimonialText": "Five stars.",
    "rating": 5,
    "additionalValues": { "companyName": "ACME" }
  }
]
```

No `contributorEmail`, no `isFavorite`, no other spaces' testimonials.

---

## 13. Changes vs. current `prisma/schema.prisma`

| Change | Why | Section |
|---|---|---|
| `Subscription.@@unique([userId])` | Prevent duplicate rows on webhook retries. | §7 |
| `Subscription.cancelAtPeriodEnd Boolean @default(false)` | Honor "cancel at period end" semantics. | §7 |
| `EmbedConfiguration.@@unique([spaceId])` | Enforce 1:1 embed config per space. | §8 |
| `Testimonial.@@index([spaceId, submissionTimestamp])` | Speed up inbox and chart queries. | §6 |
| `SpaceField.@@index([spaceId, displayOrder])` | Speed up form config load. | §5 |

No tables are added or removed. No columns are renamed.

---

## 14. Out of scope (deferred to v2)

- **Full-text search** (`tsvector` or external). MVP uses `LIKE`.
- **Drag-and-drop testimonial reordering** (no `displayOrder` column on `Testimonial`).
- **Multi-variant embeds** per space (current unique constraint is 1:1).
- **Public submission tokens** / CAPTCHA (slug-only auth in MVP).
- **Subscription history table** (current state is the only thing stored locally).
- **Spam / archive visibility statuses** (only `published` / `hidden` for MVP).
- **Email verification flow** (the `User` table is auth-ready; the auth library is not installed).
- **Audit log** (Stripe is the source of truth for billing history).
