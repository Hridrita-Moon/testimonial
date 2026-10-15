// Next.js 16.4 renamed `middleware.ts` to `proxy.ts`. The semantics
// are identical — this file gates dashboard and account paths behind
// an authenticated session.
//
// The `authorized` callback in `lib/auth.ts` does the actual gating:
// for any `/dashboard/*` request, it checks `auth?.user` and
// returns either `true` (proceed) or a `Response.redirect` to
// `/sign-in?next=<original>` (unauthenticated). The proxy itself
// just re-exports the `auth` function so Auth.js can wire up the
// matcher and the authorized callback together.
//
// Why this works for the auth routing:
//   - The proxy runs BEFORE the page renders. If the user is
//     unauthenticated, the request is short-circuited with a 307
//     to `/sign-in?next=/dashboard`. The dashboard page never
//     executes. The "renders a blank page" failure mode is
//     therefore impossible for first-time dashboard hits.
//   - The dashboard layout's `await auth()` check inside
//     `DashboardLayoutData` is a belt-and-braces guard for the
//     rare case where the cookie is set but the session can't
//     be read (e.g. a config rollback that broke Auth.js). The
//     layout returns a `<RedirectToSignIn />` client island in
//     that case, which `router.replace()`s to `/sign-in` on the
//     next paint.
//   - The matcher is intentionally narrow: the public surface
//     (root, public submission page, public submission API,
//     Auth.js catch-all, Stripe webhook, Next.js internals, and
//     static assets) is never passed through the proxy. The
//     sign-in and sign-up pages are also public — a signed-in
//     user visiting `/sign-in` or `/sign-up` is allowed to see
//     the form (with an "already signed in" banner), so the
//     proxy does not interfere with that flow.
//
// Next 16.4 requires the file to export a function (default or
// named "proxy"). Auth.js v5's `auth` is callable, but re-exporting
// it directly tripped the build's "is this a function?" check, so
// we wrap it in a thin local handler. The body is identical to
// what `auth` does — the wrapper just gives Next a stable
// function reference to inspect.

import { auth } from "@/lib/auth";

export default auth;

export const config = {
  matcher: [
    // Dashboard and (future) account paths. Everything else is
    // public and is left alone. The sign-in and sign-up pages
    // are intentionally NOT in the matcher — they must work for
    // both signed-in and signed-out visitors.
    "/dashboard/:path*",
    "/account/:path*",
  ],
};
