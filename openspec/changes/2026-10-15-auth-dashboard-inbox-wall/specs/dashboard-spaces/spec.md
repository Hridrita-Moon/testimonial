# dashboard-spaces Specification

## Purpose

Lets an authenticated owner create, list, edit, and delete `Space` rows and their `SpaceField` configuration from the dashboard. Owns the dashboard layout shell, the dashboard index, the spaces pages (list, new, edit, post-create success), the spaces API routes, the slug uniqueness rule, the default-field seeder, and the plan-limit gate on create. Boundary: any code path that mutates a `Space` or that renders the owner's view of their own spaces.

The data-model invariants (the `Space` schema, the 6-`fieldType` closed set for `SpaceField`, slug uniqueness, the `SpaceField.@@index([spaceId, displayOrder])`) are owned by the `data-model` capability and not duplicated here.

## ADDED Requirements

### Requirement: Dashboard layout requires a session
The system SHALL render a top bar with the signed-in user's name and a sign-out button on every page under `/dashboard/*`. The layout reads `await auth()` and, when no session is present, SHALL redirect to `/sign-in?next=<current-path>`. The redirect preserves the original path so the post-login navigation lands the user back where they started.

#### Scenario: Unauthenticated access redirects to sign-in
- **WHEN** an unauthenticated client GETs `/dashboard` or any sub-path
- **THEN** the response is a 307 redirect to `/sign-in?next=<original-path>`

#### Scenario: Authenticated access renders the top bar
- **WHEN** an authenticated client GETs `/dashboard`
- **THEN** the page renders the user's name and a sign-out button in the top bar

### Requirement: Dashboard index surfaces owner-relevant data
The system SHALL render a `/dashboard` index page that shows: the current plan (Free or Premium), the number of spaces used vs. the plan's `maxSpaces` limit, the total number of testimonials across all of the owner's spaces, the average rating across all rated testimonials when at least one space has `ratingEnabled = true` (otherwise the average is rendered as "N/A"), the most recent 10 testimonials (across all of the owner's spaces, ordered `submissionTimestamp DESC`), and a "+ New space" call-to-action that links to `/dashboard/spaces/new`.

#### Scenario: Dashboard renders counts and recent activity
- **WHEN** an authenticated owner has 2 spaces with 5 testimonials between them and 3 of those testimonials have a `rating`
- **THEN** the dashboard shows `spacesUsed: 2`, a per-plan usage bar, `totalTestimonials: 5`, an `averageRating` computed from the 3 rated rows, the 5 most recent testimonials in the activity list, and a "+ New space" button

#### Scenario: Average is N/A when no spaces have ratings
- **WHEN** an authenticated owner has 2 spaces and both have `ratingEnabled = false`
- **THEN** the dashboard renders the average rating as "N/A"

### Requirement: Spaces list page
The system SHALL render a `/dashboard/spaces` page that lists every `Space` owned by the signed-in user, ordered by `createdAt DESC`. Each row shows the title, the `publicSlug`, the testimonial count, a link to the public page (`/p/<slug>`), a link to the edit page (`/dashboard/spaces/<id>`), and a delete button. Other users' spaces are never rendered (the page query is scoped by `ownerId = session.user.id`).

#### Scenario: List shows only the signed-in user's spaces
- **WHEN** an authenticated owner with 2 spaces GETs `/dashboard/spaces`
- **THEN** the page renders 2 rows, each scoped to that owner

### Requirement: Create a space
The system SHALL let an authenticated owner create a new `Space` by POSTing to `/api/spaces` with `{ title, subtitle?, prompt, theme, ratingEnabled, publicSlug?, enabledFields?: { companyName, socialLinks, profilePhoto } }`. The server SHALL:
  - Derive `ownerId` from the session, not from the request body.
  - Validate the body via Zod.
  - Reject if the owner is at `maxSpaces` for their plan (403 with a `max_spaces` plan-limit error).
  - Auto-generate `publicSlug` from `title` (kebab-case) when the body's `publicSlug` is omitted.
  - Probe the `publicSlug` for uniqueness; on collision, append a 4-character random base36 suffix and retry. Repeat up to 5 times.
  - Persist the `Space` and the 6 default `SpaceField` rows in a single transaction.
  - Default field config: `name`, `email`, `testimonialText` are always `enabled = true, required = true`; `companyName`, `socialLinks`, `profilePhoto` are `enabled` per the body's `enabledFields` (default: all disabled) and `required = false` for all three.
  - Return 201 with `{ id, publicSlug }` on success.

#### Scenario: Successful create returns 201
- **WHEN** a free-plan owner with 0 existing spaces POSTs a valid create body with `title = "Product Hunt reviews"`
- **THEN** a `Space` row is created with `publicSlug = "product-hunt-reviews"`, the 6 default `SpaceField` rows are created, and the response is 201 with `{ id, publicSlug: "product-hunt-reviews" }`

#### Scenario: Slug collision resolves with a suffix
- **WHEN** a create request's auto-generated slug already exists
- **THEN** the persisted `publicSlug` is the original slug plus a 4-character random base36 suffix; the response echoes the final slug

#### Scenario: Plan limit blocks create
- **WHEN** a free-plan owner with 3 existing spaces POSTs a valid create body
- **THEN** no `Space` or `SpaceField` rows are created and the response is 403 with a `max_spaces` error

#### Scenario: Invalid body is rejected
- **WHEN** the create body's `title` is empty
- **THEN** the response is 422 with a field-level error on `title`

### Requirement: Edit a space
The system SHALL let an authenticated owner edit one of their `Space` rows by PATCHing `/api/spaces/<id>` with the same body shape as create. The server SHALL:
  - Reject with 404 when the space is owned by a different user.
  - Re-validate the body via Zod.
  - Re-probe `publicSlug` for uniqueness; on collision (and the collision is not the same space), append a 4-character random base36 suffix.
  - Persist the changes and update the `SpaceField` rows whose `fieldType` is one of the three optional types to match the new `enabledFields`.
  - The three core field rows (`name`, `email`, `testimonialText`) are never modified or removed by an edit.
  - Return 200 with the updated space on success.

#### Scenario: Successful edit
- **WHEN** an owner PATCHes one of their spaces with `title = "Updated title"`, `enabledFields.companyName = true`
- **THEN** the space's `title` is updated and the `companyName` `SpaceField` row's `enabled` flips to `true`; the three core field rows are unchanged

#### Scenario: Editing another user's space returns 404
- **WHEN** a user PATCHes a space they do not own
- **THEN** the response is 404 and no rows are modified

### Requirement: Delete a space
The system SHALL let an authenticated owner delete one of their `Space` rows by DELETing `/api/spaces/<id>`. The server SHALL:
  - Reject with 404 when the space is owned by a different user.
  - Cascade-delete the space's `SpaceField` rows, `Testimonial` rows, and `EmbedConfiguration` rows (the existing schema already cascades on `Space.id` deletion).
  - Return 204 on success.

#### Scenario: Successful delete cascades
- **WHEN** an owner DELETEs one of their spaces
- **THEN** the `Space`, its `SpaceField` rows, its `Testimonial` rows, and its `EmbedConfiguration` row are removed; the response is 204

#### Scenario: Deleting another user's space returns 404
- **WHEN** a user DELETEs a space they do not own
- **THEN** the response is 404 and nothing is modified

### Requirement: Post-create success screen
The system SHALL render a `/dashboard/spaces/<id>/created` success page after a successful create. The page shows the public URL (`/p/<publicSlug>`), a "Copy link" button, an "Open page" link that opens the public URL in a new tab, and a "Back to dashboard" link.

#### Scenario: Success page shows the public URL
- **WHEN** an owner navigates to `/dashboard/spaces/<id>/created` after a successful create
- **THEN** the page renders the public URL `/p/<publicSlug>` with a copy button and an open link

### Requirement: Cross-user isolation
The system SHALL scope every spaces query and mutation by `ownerId = session.user.id`. A user SHALL NOT be able to list, read, edit, or delete another user's spaces by manipulating the URL or the request body.

#### Scenario: List is scoped to the session owner
- **WHEN** a user GETs `/dashboard/spaces` or `GET /api/spaces`
- **THEN** the response contains only spaces whose `ownerId = session.user.id`

#### Scenario: Detail page is scoped to the session owner
- **WHEN** a user GETs `/dashboard/spaces/<id>` for a space they do not own
- **THEN** the response is a 404 page

### Requirement: Out-of-scope dashboard spaces behaviors
The system SHALL NOT in MVP: support per-field add/reorder/required/custom-label UI beyond toggling the 3 optional fields on/off; support theme previews beyond the two stored values (`light` and `dark`); support bulk delete; support a "duplicate space" action; support custom domains. Field toggles are the only editable form-field config; the three core fields are always required and enabled (per `data-model.md` §5).

#### Scenario: Core fields are not editable
- **WHEN** an owner PATCHes a space with any value attempting to disable or un-require the `name`, `email`, or `testimonialText` `SpaceField` rows
- **THEN** the server ignores those values and the persisted `SpaceField` rows are unchanged
