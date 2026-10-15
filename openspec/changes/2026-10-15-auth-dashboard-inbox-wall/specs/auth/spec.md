# auth Specification

## Purpose

Adds user registration, sign-in, and sign-out to the Testimonial SaaS MVP. Owns the credential-based authentication flow (Auth.js v5, JWT session strategy), the password hashing helpers, the sign-up / sign-in / sign-out pages, and the Next.js middleware that gates `/dashboard/*` and any future `/account/*` routes. Boundary: any code path that derives the current `User` from a request, or that lets a visitor create or destroy such a session.

The data-model invariant — `User.email` is unique and `User.passwordHash` is server-only — is owned by the `data-model` capability and not duplicated here.

## ADDED Requirements

### Requirement: Email and password registration
The system SHALL let an unauthenticated visitor create a `User` by POSTing `{ name, email, password }` to `/api/auth/register`. The server SHALL validate the body (email is a valid address and ≤ 320 characters, password is at least 8 characters, name is 1–120 characters), hash the password with `bcryptjs` at 10 rounds, and persist a new `User` row. On success the response is 201 and the new account is auto-signed-in via the credentials provider. On a duplicate email the response is 409 with a caller-friendly message. On a malformed body the response is 422 with a field-level error. The response never includes `passwordHash`.

#### Scenario: Successful registration
- **WHEN** the body satisfies the validation rules and the email is not already in use
- **THEN** a `User` row is created and the response is 201 with `{ id, email, name }`; the client subsequently has a valid session cookie

#### Scenario: Duplicate email is rejected
- **WHEN** the body satisfies the validation rules but a `User` with the same `email` already exists
- **THEN** no `User` row is created and the response is 409 with a `duplicate_email` code

#### Scenario: Weak password is rejected
- **WHEN** the body's `password` is shorter than 8 characters
- **THEN** no `User` row is created and the response is 422 with a field-level error on `password`

#### Scenario: Invalid email is rejected
- **WHEN** the body's `email` is not a valid email address
- **THEN** no `User` row is created and the response is 422 with a field-level error on `email`

### Requirement: Credentials sign-in
The system SHALL let an unauthenticated visitor sign in by POSTing credentials to the Auth.js v5 catch-all route at `/api/auth/callback/credentials`. The server SHALL look up the user by `email`, compare the password against `passwordHash` with `bcrypt.compare`, and on success issue a JWT session cookie. On failure the response is 401 and no cookie is set. The `passwordHash` is never returned in any sign-in response.

#### Scenario: Valid credentials issue a session
- **WHEN** the body contains an existing user's `email` and the correct `password`
- **THEN** a `next-auth.session-token` cookie is set and the response is 200

#### Scenario: Wrong password is rejected
- **WHEN** the body's `email` exists but the `password` does not match
- **THEN** no session cookie is set and the response is 401

#### Scenario: Unknown email is rejected
- **WHEN** the body's `email` does not exist
- **THEN** no session cookie is set and the response is 401 (the same response as a wrong password — no user-enumeration leak)

### Requirement: Sign-out
The system SHALL let an authenticated user sign out by POSTing to the Auth.js v5 sign-out endpoint. The server SHALL clear the session cookie and the response is 200. Subsequent requests to `/dashboard/*` are redirected to `/sign-in?next=...`.

#### Scenario: Sign-out clears the session
- **WHEN** an authenticated user POSTs to the sign-out endpoint
- **THEN** the `next-auth.session-token` cookie is cleared and the response is 200

### Requirement: Dashboard routes are auth-gated
The system SHALL gate every route under `/dashboard/*` (and any future `/account/*`) behind the session middleware. An unauthenticated request to a gated route is redirected to `/sign-in?next=<original-path>` (preserving the original path so the post-login redirect works). A signed-in user accessing a gated route is served the page.

#### Scenario: Unauthenticated request is redirected
- **WHEN** a request to `/dashboard` or any sub-path has no valid session cookie
- **THEN** the response is a 307 redirect to `/sign-in?next=<original>`

#### Scenario: Authenticated request is served
- **WHEN** a request to `/dashboard` has a valid session cookie
- **THEN** the response is 200 and renders the dashboard for the session's `userId`

### Requirement: Public routes are not gated
The system SHALL NOT gate the public submission page (`/p/*`), the public submission API (`/api/spaces/*/testimonials`), the Auth.js catch-all (`/api/auth/*`), the Stripe webhook (`/api/stripe/webhook`), the public landing page (`/`), the Wall of Love (`/p/*/wall`), the sign-in page (`/sign-in`), the sign-up page (`/sign-up`), Next.js internals (`/_next/*`), and static assets. These paths are accessible to unauthenticated clients.

#### Scenario: Public submission page is reachable without auth
- **WHEN** an unauthenticated client GETs `/p/<slug>`
- **THEN** the response is 200 and the form is rendered (no redirect to `/sign-in`)

#### Scenario: Auth.js callback is reachable without auth
- **WHEN** an unauthenticated client POSTs to `/api/auth/callback/credentials`
- **THEN** the response is processed normally (the auth flow itself)

### Requirement: Session carries the user id
The system SHALL make `session.user.id` available to every server component and route handler that calls `auth()`. The id is set in the JWT `callbacks.jwt` on sign-in and re-exposed in `callbacks.session` on every request. The id is the `User.id` from the database.

#### Scenario: Server component can read the session id
- **WHEN** a server component under `/dashboard/*` calls `await auth()`
- **THEN** the returned session has `session.user.id` equal to the signed-in user's database id

#### Scenario: Route handler can read the session id
- **WHEN** a route handler under `/api/spaces/*` calls `await auth()`
- **THEN** the returned session has `session.user.id` equal to the signed-in user's database id, or `null` when the request is unauthenticated

### Requirement: Password storage and verification
The system SHALL hash passwords with `bcryptjs` at 10 rounds on registration and SHALL verify them with `bcrypt.compare` on sign-in. The `passwordHash` column is never returned in any API response, never rendered in any server component, and never logged.

#### Scenario: Passwords are hashed before storage
- **WHEN** a new `User` is created via the registration endpoint
- **THEN** the persisted `User.passwordHash` is a bcrypt hash, not the plaintext password

#### Scenario: Password hash is never returned
- **WHEN** any server component or API route returns a `User` record
- **THEN** the response body does not contain the `passwordHash` field

### Requirement: Out-of-scope auth behaviors
The system SHALL NOT in MVP: send a verification email on registration, support password reset, support social providers (Google, GitHub, etc.), support passkeys, support multi-factor authentication, or rate-limit the sign-in endpoint. Session lifetime is the Auth.js v5 default (sliding 30-day JWT). Email enumeration on the sign-up endpoint is acceptable (the response distinguishes "duplicate email" from "invalid email"); the sign-in endpoint deliberately does not distinguish "unknown email" from "wrong password".

#### Scenario: No verification email is sent
- **WHEN** a new `User` is created
- **THEN** no email is sent to the new address

#### Scenario: Sign-in does not leak user existence
- **WHEN** a sign-in attempt is made with an unknown email
- **THEN** the response is 401 with the same body shape as a wrong-password attempt
