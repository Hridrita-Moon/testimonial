# inbox-and-wall Specification

## Purpose

Lets the owner triage incoming testimonials (favorite, add to Wall of Love, hide, edit, delete) from a dashboard inbox, and lets any visitor view a curated public Wall of Love at `/p/<slug>/wall`. Owns the inbox service layer, the inbox page and its filter UI, the per-action testimonial API routes, the testimonial edit dialog, and the public Wall of Love page. Boundary: any code path that touches the visibility flags on a `Testimonial` and the public display derived from them.

The data-model invariants (the `isFavorite DESC, submissionTimestamp DESC` ordering, the `isWallOfLove = true AND visibilityStatus = 'published'` Wall of Love query, the 1-5 rating range, the `contributorEmail` privacy) are owned by the `data-model` capability and not duplicated here.

## ADDED Requirements

### Requirement: Inbox list
The system SHALL render a `/dashboard/inbox` page that lists every `Testimonial` belonging to a `Space` owned by the signed-in user, ordered `isFavorite DESC, submissionTimestamp DESC`. The list query is scoped by `Space.ownerId = session.user.id` so other users' testimonials are never rendered. Each card shows: contributor name, contributor email (visible to the owner only), the associated space's title, submission date and time, testimonial text, rating (if `Space.ratingEnabled` is true), social-consent status, current visibility status, and a row of action buttons.

#### Scenario: Inbox shows the owner's testimonials
- **WHEN** an authenticated owner has 7 testimonials across 2 spaces
- **THEN** the inbox page renders 7 cards, ordered favorite-first then newest-first, each scoped to the owner

#### Scenario: Inbox never shows another user's testimonials
- **WHEN** an authenticated owner GETs `/dashboard/inbox`
- **THEN** the page never includes testimonials whose `Space.ownerId` is anyone other than the session user

### Requirement: Inbox filters
The system SHALL let the owner filter the inbox by `spaceId`, `rating`, `visibilityStatus`, date range (`fromDate`, `toDate`), search text (`q`, matched via Prisma `contains` on `contributorName` and `testimonialText`), and a favorite-only toggle. Filter state lives in the URL as search parameters so deep links and back-button navigation work. The default filter state (no params) is the full list.

#### Scenario: Filter by space narrows the list
- **WHEN** the inbox URL has `?spaceId=<id>` for a space the owner owns
- **THEN** the rendered list contains only that space's testimonials

#### Scenario: Search narrows the list
- **WHEN** the inbox URL has `?q=onboarding`
- **THEN** the rendered list contains only testimonials whose `contributorName` or `testimonialText` contains the substring `onboarding` (case-insensitive)

#### Scenario: Favorite-only filter
- **WHEN** the inbox URL has `?favorite=1`
- **THEN** the rendered list contains only `isFavorite = true` testimonials

### Requirement: Favorite action
The system SHALL expose `POST /api/testimonials/<id>/favorite` that accepts `{ favorite: boolean }`, sets the testimonial's `isFavorite` flag, and returns 200. The route derives ownership from the underlying `Space.ownerId = session.user.id`; a cross-user request returns 404. After a successful call the inbox UI refreshes.

#### Scenario: Favoriting persists
- **WHEN** an owner POSTs `{ favorite: true }` to one of their testimonials
- **THEN** the row's `isFavorite` is `true`, the response is 200, and the testimonial floats to the top of the inbox

#### Scenario: Cross-user favorite returns 404
- **WHEN** a user POSTs to another owner's testimonial
- **THEN** the response is 404 and no rows are modified

### Requirement: Wall of Love action
The system SHALL expose `POST /api/testimonials/<id>/wall-of-love` that accepts `{ wallOfLove: boolean }`, sets the testimonial's `isWallOfLove` flag, and returns 200. The route derives ownership from the underlying `Space.ownerId = session.user.id`; a cross-user request returns 404. Toggling the flag updates the public Wall of Love on the next request.

#### Scenario: Adding to wall of love makes the testimonial public
- **WHEN** an owner POSTs `{ wallOfLove: true }` to a `visibilityStatus = 'published'` testimonial
- **THEN** the row's `isWallOfLove` is `true` and the testimonial is rendered on `/p/<slug>/wall` for that space

#### Scenario: Removing from wall of love hides it from the public page
- **WHEN** an owner POSTs `{ wallOfLove: false }` to a wall-of-love testimonial
- **THEN** the row's `isWallOfLove` is `false` and the testimonial is no longer rendered on `/p/<slug>/wall`

### Requirement: Visibility action
The system SHALL expose `POST /api/testimonials/<id>/visibility` that accepts `{ visibility: "published" | "hidden" }`, sets the testimonial's `visibilityStatus`, and returns 200. The route derives ownership from `Space.ownerId = session.user.id`; a cross-user request returns 404. Hidden testimonials are excluded from the public Wall of Love and from the inbox's default view (an explicit `?visibility=hidden` filter surfaces them).

#### Scenario: Hiding a wall-of-love testimonial removes it from the public page
- **WHEN** an owner POSTs `{ visibility: "hidden" }` to a testimonial that is on the wall of love
- **THEN** the testimonial is no longer rendered on `/p/<slug>/wall` (the wall filter requires `visibilityStatus = 'published'`)

#### Scenario: Unhiding restores the testimonial
- **WHEN** an owner POSTs `{ visibility: "published" }` to a hidden testimonial
- **THEN** the testimonial is again visible wherever the default visibility filter applies

### Requirement: Edit a testimonial
The system SHALL expose `PATCH /api/testimonials/<id>` that accepts `{ contributorName, contributorEmail, testimonialText, rating?, additionalValues? }`, validates via Zod (rating 1-5 when present, email format, name 1-200 chars, text 1-5000 chars, `additionalValues` shape), persists the changes, and returns 200. The route derives ownership from `Space.ownerId = session.user.id`; a cross-user request returns 404. The visibility flags (`isFavorite`, `isWallOfLove`, `visibilityStatus`) are not editable via this endpoint — they have their own per-action routes.

#### Scenario: Successful edit
- **WHEN** an owner PATCHes one of their testimonials with a new `testimonialText`
- **THEN** the row's `testimonialText` is updated, the response is 200, and the inbox renders the new text

#### Scenario: Invalid rating is rejected
- **WHEN** the body's `rating` is outside 1-5
- **THEN** the response is 422 with a field-level error on `rating` and the row is unchanged

### Requirement: Delete a testimonial
The system SHALL expose `DELETE /api/testimonials/<id>` that removes the testimonial row and returns 204. The route derives ownership from `Space.ownerId = session.user.id`; a cross-user request returns 404. A delete is a hard delete (no soft-delete column in the schema).

#### Scenario: Successful delete
- **WHEN** an owner DELETEs one of their testimonials
- **THEN** the row is removed, the response is 204, and the inbox no longer renders it

### Requirement: Public Wall of Love page
The system SHALL render a public HTML page at `/p/<slug>/wall` for any visitor (no auth required) that shows every `Testimonial` for the resolved space where `isWallOfLove = true AND visibilityStatus = 'published'`, ordered `isFavorite DESC, submissionTimestamp DESC`. Each card shows the contributor name, the company name from `additionalValues.companyName` (when present), the testimonial text, and the rating (when `Space.ratingEnabled` is true). The contributor's email is never rendered; the `socialLinks` and `profilePhoto` fields are not rendered in MVP. An unknown slug returns 404.

#### Scenario: Public wall renders only eligible testimonials
- **WHEN** a space has 2 wall-of-love + published testimonials and 1 wall-of-love + hidden testimonial
- **THEN** the public wall page renders the 2 published testimonials and never the hidden one

#### Scenario: Public wall 404s on unknown slug
- **WHEN** an unauthenticated client GETs `/p/<unknown-slug>/wall`
- **THEN** the response is 404 and no `Testimonial` data is leaked

#### Scenario: Public wall never returns contributor email
- **WHEN** any testimonial is rendered on `/p/<slug>/wall`
- **THEN** neither the page HTML nor any underlying API response includes `contributorEmail`

### Requirement: Link from public submission page
The system SHALL render a "View our Wall of Love" link at the bottom of `/p/<slug>` when the space has at least one `isWallOfLove = true AND visibilityStatus = 'published'` testimonial. When the wall is empty, the link is not rendered.

#### Scenario: Link is shown when the wall has entries
- **WHEN** a space has at least one published wall-of-love testimonial
- **THEN** the bottom of `/p/<slug>` shows a link to `/p/<slug>/wall`

#### Scenario: Link is hidden when the wall is empty
- **WHEN** a space has zero published wall-of-love testimonials
- **THEN** the bottom of `/p/<slug>` does not show the wall-of-love link

### Requirement: Cross-user isolation
The system SHALL scope every inbox query and every testimonial mutation by the underlying `Space.ownerId = session.user.id`. A user SHALL NOT be able to read, edit, or delete another user's testimonials, nor toggle their visibility flags, by manipulating the URL or the request body.

#### Scenario: Detail fetch is scoped
- **WHEN** a user GETs `/api/testimonials/<id>` for a testimonial they do not own
- **THEN** the response is 404

### Requirement: Out-of-scope inbox and wall behaviors
The system SHALL NOT in MVP: support drag-to-reorder within the inbox (the ordering is computed from the existing flags); support full-text search beyond the case-insensitive `contains` filter; support spam / archived visibility statuses; support bulk actions (bulk-favorite, bulk-delete); render the public wall as a paginated list (the per-plan cap is 100/1000 testimonials per space, which is bounded); render `socialLinks` or `profilePhoto` on the public wall; rate-limit the public wall page (the data is read-only and the slug is the credential).

#### Scenario: Inbox ordering is computed, not stored
- **WHEN** an owner marks a testimonial as favorite
- **THEN** the row's `displayOrder` is unchanged and the inbox re-orders via the `isFavorite DESC, submissionTimestamp DESC` query

#### Scenario: No soft-delete
- **WHEN** an owner DELETEs a testimonial
- **THEN** the row is removed from the database (not marked hidden or archived)
