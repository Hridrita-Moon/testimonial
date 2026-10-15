# data-model Specification

## Purpose

Defines the persisted schema for the Testimonial SaaS MVP — the six tables, their relations, the uniqueness and index invariants, and the data contracts (allowed values, required fields, ordering and search behavior) that every feature capability (spaces, wall of love, embed, billing) will rely on. It is the single source of truth for what the database guarantees; service-layer code enforces the rest.

## Requirements

### Requirement: Persisted user accounts
The system SHALL persist a user account with a unique email address, a server-side `passwordHash`, and creation/update timestamps. The user is the owner of zero or more spaces and zero or one subscription rows.

#### Scenario: Email is unique
- **WHEN** two users attempt to register with the same email
- **THEN** the second insert fails with a unique-email constraint violation

#### Scenario: Password hash is server-side only
- **WHEN** any read path returns a user record through a public or dashboard API
- **THEN** `passwordHash` is never included in the response payload

### Requirement: Spaces owned by a user
The system SHALL persist a `Space` owned by exactly one `User` (cascade on user delete). A space has a required title and prompt, an optional subtitle, a `theme` default of `light`, a `ratingEnabled` boolean defaulting to `true`, and a globally unique `publicSlug` used to address the public submission route.

#### Scenario: Slug collision resolves with a suffix
- **WHEN** a user creates a space whose auto-generated or edited slug already exists
- **THEN** the server appends a 4-character random suffix and persists a unique value

#### Scenario: Public submission routes by slug
- **WHEN** an unauthenticated client POSTs to `/api/spaces/[slug]/testimonials`
- **THEN** the system resolves the target space by `publicSlug` only; a missing slug returns 404

### Requirement: Per-space form-field configuration
The system SHALL persist one `SpaceField` row per enabled form-field per space. Each row has a `fieldType` from the closed set `{ name, email, testimonialText, companyName, socialLinks, profilePhoto }`, a `label`, an `enabled` boolean defaulting to `true`, a `required` boolean defaulting to `false`, and a `displayOrder` integer.

#### Scenario: Required fields are enforced on submit
- **WHEN** a public submission omits a value for a `SpaceField` whose `enabled=true` and `required=true`
- **THEN** the submission is rejected with a validation error

#### Scenario: Name, email, and testimonialText are always required
- **WHEN** a space's form-field configuration is created or edited
- **THEN** rows for `name`, `email`, and `testimonialText` exist with `enabled=true` and `required=true`

#### Scenario: Form loads in display order
- **WHEN** the public form page renders for a space
- **THEN** the enabled `SpaceField` rows are returned ordered by `displayOrder` ascending

### Requirement: Testimonials persisted with visibility flags
The system SHALL persist a `Testimonial` belonging to exactly one `Space` (cascade on space delete) with the contributor's name, email, and testimonial text (all required and non-empty), an optional 1–5 `rating` (nullable when the space has `ratingEnabled=false`), an `additionalValues` JSON column holding `{ companyName?, socialLinks?, profilePhoto? }`, and the boolean flags `socialConsent`, `isFavorite`, `isWallOfLove`, and `visibilityStatus` (`published` | `hidden`).

#### Scenario: Rating rejected outside 1–5
- **WHEN** a public submission includes a `rating` outside the inclusive range 1–5
- **THEN** the submission is rejected with a validation error

#### Scenario: Rating ignored when ratingEnabled is false
- **WHEN** a public submission includes a `rating` value and the target space has `ratingEnabled=false`
- **THEN** the rating is dropped before persistence and the testimonial is stored with `rating = NULL`

#### Scenario: Hidden testimonials are not returned by default
- **WHEN** an inbox or chart query lists testimonials for a space
- **THEN** rows with `visibilityStatus = 'hidden'` are excluded by default

#### Scenario: Contributor email is private
- **WHEN** a public endpoint returns a testimonial (wall of love, embed)
- **THEN** `contributorEmail` is never included in the response payload

### Requirement: Inbox ordering and search
The system SHALL order inbox results by `isFavorite DESC, submissionTimestamp DESC` and SHALL support case-insensitive substring search on `contributorName` and `testimonialText` using `LIKE '%term%'` semantics. There is no `displayOrder` column on testimonials in MVP.

#### Scenario: Favorites float to the top
- **WHEN** an inbox query lists testimonials for a space
- **THEN** rows with `isFavorite = true` appear before rows with `isFavorite = false`, and ties are broken by `submissionTimestamp DESC`

#### Scenario: Search matches name or text
- **WHEN** an inbox query includes a search term
- **THEN** only testimonials whose `contributorName` OR `testimonialText` contains the term (case-insensitive substring) are returned

### Requirement: Public Wall of Love visibility
The system SHALL expose a public Wall of Love for a space that includes only testimonials where `isWallOfLove = true` AND `visibilityStatus = 'published'`.

#### Scenario: Hidden or unfavorited rows are excluded
- **WHEN** a public client requests the wall for a space
- **THEN** only rows where `isWallOfLove = true` AND `visibilityStatus = 'published'` are returned

### Requirement: One subscription per user
The system SHALL persist at most one `Subscription` row per user. The unique constraint on `userId` is the safety net that prevents duplicate rows on Stripe webhook retries.

#### Scenario: Webhook retry cannot create a duplicate
- **WHEN** a Stripe webhook event for an existing user is retried
- **THEN** the second attempt updates the existing row rather than creating a new one

#### Scenario: User has no subscription row
- **WHEN** a user has never subscribed
- **THEN** they are treated as `plan = 'free'`, `status = 'active'`, `cancelAtPeriodEnd = false` without a database row

### Requirement: Subscription state machine
The system SHALL map Stripe subscription events to the local `Subscription` row per `data-model.md` §7, with `cancelAtPeriodEnd` mirroring Stripe's value at all times.

#### Scenario: Active or trialing subscription
- **WHEN** Stripe sends `customer.subscription.created` or `customer.subscription.updated` with status `active` or `trialing`
- **THEN** the local row is set to `plan='premium', status='active'`

#### Scenario: Past-due or unpaid subscription
- **WHEN** Stripe sends `customer.subscription.updated` with status `past_due` or `unpaid`, or `invoice.payment_failed`
- **THEN** the local row is set to `status='past_due'`; `plan` is unchanged

#### Scenario: Immediate cancellation
- **WHEN** Stripe sends `customer.subscription.updated` to `canceled` (immediate) or `customer.subscription.deleted`
- **THEN** the local row is set to `plan='free', status='cancelled', cancelAtPeriodEnd=true`

#### Scenario: User re-subscribes
- **WHEN** a user who previously cancelled re-subscribes
- **THEN** the existing row is updated to `plan='premium', status='active'` and `stripeSubscriptionId` reflects the new subscription; `stripeCustomerId` is preserved

### Requirement: One embed configuration per space
The system SHALL persist at most one `EmbedConfiguration` per space. The `EmbedConfiguration.id` is the identifier that public embed JS snippets reference.

#### Scenario: Embed fetch is scoped to one space
- **WHEN** a public client loads the embed JS snippet with an `EmbedConfiguration.id`
- **THEN** the system returns only testimonials for that space where `visibilityStatus = 'published'` and never includes `contributorEmail`, `isFavorite`, or testimonials from any other space

### Requirement: Indexes supporting read paths
The system SHALL provide indexes that match the documented read paths: `(spaceId, submissionTimestamp)` on `Testimonial` for inbox and chart, `(spaceId, isWallOfLove, visibilityStatus)` on `Testimonial` for public Wall of Love, `(spaceId, displayOrder)` on `SpaceField` for form rendering.

#### Scenario: Queries use supported indexes
- **WHEN** the inbox list, the chart, the Wall of Love, or the form renderer runs
- **THEN** the query plan uses one of the indexes listed above for the space-scoped portion of the filter

### Requirement: Cascade deletes preserve referential integrity
The system SHALL cascade-delete child rows when a parent is deleted: deleting a `User` removes their `Space`, `SpaceField`, `Testimonial`, `Subscription`, and `EmbedConfiguration` rows; deleting a `Space` removes its `SpaceField`, `Testimonial`, and `EmbedConfiguration` rows.

#### Scenario: User deletion cascades
- **WHEN** a user is deleted
- **THEN** all of that user's spaces, fields, testimonials, and subscription rows are removed in the same transaction

### Requirement: Out-of-scope behaviors
The system SHALL NOT support in MVP: full-text search, drag-and-drop testimonial reordering, multi-variant embeds per space, public submission tokens / CAPTCHA, subscription history table, spam/archived visibility statuses, or an audit log. These are deferred to v2.

#### Scenario: No FTS or drag-reorder
- **WHEN** a future feature asks for full-text search, drag-and-drop reorder, multi-variant embeds, submission tokens, subscription history, spam/archived status, or audit log
- **THEN** the data model does not provide columns, indexes, or relations for it in MVP
