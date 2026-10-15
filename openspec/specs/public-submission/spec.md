# public-submission Specification

## Purpose

Lets an unauthenticated visitor open a public form at `/p/<slug>`, fill in the per-space configured fields, and submit a testimonial that is persisted as a published `Testimonial` row. The form and the submission endpoint share one validation contract and one plan-limit gate; the data-model rules (slug routing, cascades, index usage, email privacy) are owned by the `data-model` capability and are not duplicated here.

## Requirements

### Requirement: Public form page renders the per-space form
The system SHALL serve a public HTML page at `/p/<slug>` for any visitor (no auth required), render the enabled `SpaceField` rows in `displayOrder` ascending, and use each row's `label` as the visible field label.

#### Scenario: Form loads for a valid slug
- **WHEN** an unauthenticated client GETs `/p/<slug>` and a `Space` exists with that `publicSlug`
- **THEN** the page returns 200 and shows the space's title, prompt, and one input per `SpaceField` row where `enabled = true`, ordered by `displayOrder` ascending

#### Scenario: Form 404s on unknown slug
- **WHEN** an unauthenticated client GETs `/p/<slug>` and no `Space` exists with that `publicSlug`
- **THEN** the response is 404 and no `SpaceField` data is leaked

#### Scenario: Disabled fields are hidden
- **WHEN** a `SpaceField` row has `enabled = false`
- **THEN** the rendered form does not include an input for that fieldType, and the submission endpoint rejects any value submitted for it

### Requirement: Public submission endpoint persists a Testimonial row
The system SHALL expose `POST /api/spaces/<slug>/testimonials` that resolves the target `Space` by `publicSlug`, validates the body against the space's per-field config, drops `rating` when `Space.ratingEnabled = false`, enforces the plan limit, and on success persists a `Testimonial` with `visibilityStatus = 'published'`, `isFavorite = false`, `isWallOfLove = false`, and `submissionTimestamp = now()`.

#### Scenario: Successful submission returns 201
- **WHEN** the request body satisfies every enabled + required `SpaceField` and the plan limit allows one more submission
- **THEN** the response is 201 with `{ id }` (the new `Testimonial.id`) and the persisted row has `visibilityStatus = 'published'`, `isFavorite = false`, `isWallOfLove = false`, `socialConsent` mirroring the request body, and `submissionTimestamp` set server-side

#### Scenario: Unknown slug returns 404
- **WHEN** the request body's slug does not match any `Space.publicSlug`
- **THEN** the response is 404 and no `Testimonial` row is created

#### Scenario: Missing required field returns 422
- **WHEN** a required and enabled `SpaceField` (e.g. `name`, `email`, or `testimonialText`) is missing or empty in the body
- **THEN** the response is 422 with a field-level error identifying the field, and no `Testimonial` row is created

#### Scenario: Rating outside 1–5 is rejected
- **WHEN** the body includes a `rating` outside the inclusive range 1–5
- **THEN** the response is 422 with a field-level error on `rating`, and no `Testimonial` row is created

#### Scenario: Rating is dropped when ratingEnabled is false
- **WHEN** the body includes a `rating` and the target `Space` has `ratingEnabled = false`
- **THEN** the rating is dropped before persistence and the row is stored with `rating = NULL`; the response is 201 with the new `id`

#### Scenario: Plan limit blocks new submissions
- **WHEN** the target `Space` already has at least `maxTestimonialsPerSpace` testimonials for its owner's plan and the body is otherwise valid
- **THEN** the response is 422 with a plan-limit error message, and no `Testimonial` row is created

### Requirement: Contributor email is never returned by the public form
The system SHALL NOT include `contributorEmail` in the public form's success response, the public form's error response, or any HTML rendered by `/p/<slug>`. The contributor's own entered email is the only place it is visible to the contributor; the public submission endpoint persists it server-side but never echoes it back.

#### Scenario: Success response excludes email
- **WHEN** a submission is accepted
- **THEN** the 201 response body contains `{ id }` only and no `contributorEmail` field

#### Scenario: Error response excludes email
- **WHEN** a submission is rejected with a validation error
- **THEN** the 422 response body identifies the offending field name and message but does not echo the submitted value of `contributorEmail`

### Requirement: Public endpoint is rate-limited at the edge
The system SHALL rate-limit `POST /api/spaces/<slug>/testimonials` per source IP per space using a sliding-window limit, and SHALL return 429 with a `Retry-After` header when the limit is exceeded.

#### Scenario: Burst from one IP is throttled
- **WHEN** the same source IP submits more than the per-space limit within the sliding window
- **THEN** the next request returns 429 with a `Retry-After` header and no `Testimonial` row is created

#### Scenario: Different spaces are tracked independently
- **WHEN** the same source IP submits to space A and then to space B within the window
- **THEN** space B's counter is not affected by space A's submissions

### Requirement: Out-of-scope public submission behaviors
The system SHALL NOT in MVP: send a confirmation email after submit, require email verification, support file uploads beyond a `profilePhoto` URL, present a CAPTCHA or token challenge, or pre-moderate submissions before they appear in the inbox. Submitted rows are immediately visible to the space owner in the inbox (subject to `visibilityStatus = 'published'`), and hiding or favoriting is a dashboard action.

#### Scenario: No email is sent on submit
- **WHEN** a submission is accepted
- **THEN** the system does not enqueue or send any email to the contributor or the space owner

#### Scenario: No CAPTCHA or token is presented
- **WHEN** an unauthenticated client GETs `/p/<slug>`
- **THEN** the rendered form contains no CAPTCHA widget, no submission token, and no client-side challenge that blocks submission
