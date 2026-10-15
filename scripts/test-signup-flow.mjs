// End-to-end test for the sign-up → sign-in → dashboard flow.
//
// This is the user-reported scenario. The test exercises the
// full happy path through the auth boundaries (proxy +
// sign-up page + sign-in page + dashboard layout) and asserts:
//
//   1. Unauthenticated visitors see the sign-up form (Name,
//      Email, Password, "Create account" button) on /sign-up.
//   2. The proxy redirects unauthenticated /dashboard hits to
//      /sign-in?next=/dashboard (307).
//   3. The sign-in page renders the form for unauthenticated
//      visitors.
//   4. After POST /api/auth/register, the user is created.
//   5. After NextAuth sign-in (the same call SignUpForm makes
//      on the client), the session cookie is set.
//   6. With the session cookie, /dashboard returns 200 and
//      renders the dashboard shell.
//   7. The /sign-up page is reachable for BOTH signed-in and
//      signed-out users (no auto-redirect, no blank page); the
//      form is always visible.
//   8. The dashboard layout does not leak NEXT_REDIRECT errors
//      to the client.
//
// Cleans up by deleting the created user at the end so the
// script is idempotent.

import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3009";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`ok  : ${msg}`);
  }
}

let cookie = "";

async function req(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (!name) continue;
    const parts = cookie ? cookie.split("; ") : [];
    const filtered = parts.filter((c) => c && !c.startsWith(name + "="));
    filtered.push(`${name}=${value}`);
    cookie = filtered.join("; ");
  }
  return res;
}

// -----------------------------------------------------------------
// 1) Unauthenticated /sign-up must show the form.
// -----------------------------------------------------------------
{
  const res = await fetch(BASE + "/sign-up", { redirect: "manual" });
  const body = await res.text();
  assert(res.status === 200, `Signed-out /sign-up returns 200 (got ${res.status})`);
  assert(body.includes("Create your account"), "Sign-up page renders the heading");
  assert(body.includes('id="name"'), "Sign-up page renders the name input");
  assert(body.includes('id="email"'), "Sign-up page renders the email input");
  assert(body.includes('id="password"'), "Sign-up page renders the password input");
  assert(body.includes("Create account"), "Sign-up page renders the submit button");
  assert(
    body.toLowerCase().includes('autocomplete="new-password"'),
    "Sign-up page has the new-password autocomplete hint",
  );
}

// -----------------------------------------------------------------
// 2) Unauthenticated /sign-in must show the form.
// -----------------------------------------------------------------
{
  const res = await fetch(BASE + "/sign-in", { redirect: "manual" });
  const body = await res.text();
  assert(res.status === 200, `Signed-out /sign-in returns 200 (got ${res.status})`);
  assert(body.includes("Sign in"), "Sign-in page renders the heading");
  assert(body.includes('id="email"'), "Sign-in page renders the email input");
  assert(body.includes('id="password"'), "Sign-in page renders the password input");
}

// -----------------------------------------------------------------
// 3) Unauthenticated /dashboard must be 307-redirected to
//    /sign-in?next=/dashboard by the proxy.
// -----------------------------------------------------------------
{
  // Reset cookie to ensure we're truly unauthenticated.
  cookie = "";
  const res = await fetch(BASE + "/dashboard", { redirect: "manual" });
  assert(
    res.status === 307 || res.status === 302 || res.status === 308,
    `Unauth /dashboard returns 3xx redirect (got ${res.status})`,
  );
  const loc = res.headers.get("location") || "";
  assert(
    loc.startsWith("/sign-in") && loc.includes("next="),
    `Unauth /dashboard redirects to /sign-in?next=... (got "${loc}")`,
  );
}

// -----------------------------------------------------------------
// 4) Register a fresh user via POST /api/auth/register.
// -----------------------------------------------------------------
const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `signup-e2e-${unique}@example.com`;
const name = "Signup E2E";
const password = "hunter22hunter22";

{
  cookie = "";
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  const regBody = await reg.json().catch(() => ({}));
  assert(reg.status === 201, `Register returns 201 (got ${reg.status})`);
  assert(typeof regBody.id === "string", "Register returns a user id");
}

// -----------------------------------------------------------------
// 5) Sign in via NextAuth credentials (same as SignUpForm does
//    on the client after a 201).
// -----------------------------------------------------------------
{
  const csrfRes = await req("/api/auth/csrf");
  const csrfBody = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfBody.csrfToken;
  assert(typeof csrfToken === "string", "Got CSRF token");

  const signinRes = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: BASE + "/dashboard",
      redirect: "false",
      json: "true",
    }).toString(),
  });
  assert(
    signinRes.status === 200 || signinRes.status === 302,
    `Sign-in returns 200/302 (got ${signinRes.status})`,
  );

  const sessionRes = await req("/api/auth/session");
  const sessionBody = await sessionRes.json().catch(() => ({}));
  assert(
    Boolean(sessionBody?.user?.id),
    "Session is established after register + sign-in",
  );
}

// -----------------------------------------------------------------
// 6) /dashboard with the session cookie returns 200 and renders
//    the dashboard shell. The body must not contain a
//    NEXT_REDIRECT throw (the dashboard layout returns a
//    client island for the unauth branch, not a throw).
// -----------------------------------------------------------------
{
  const dashRes = await req("/dashboard");
  const dashBody = await dashRes.text();
  assert(dashRes.status === 200, `/dashboard returns 200 (got ${dashRes.status})`);
  assert(
    !dashBody.includes("NEXT_REDIRECT"),
    "/dashboard body does not leak NEXT_REDIRECT",
  );
  assert(
    dashBody.includes("Overview") || dashBody.includes("Spaces"),
    "/dashboard renders the dashboard shell (sidebar labels present)",
  );
}

// -----------------------------------------------------------------
// 7) /sign-up for a signed-in user must STILL render the form
//    (no auto-redirect, no blank page). The "already signed in"
//    banner is a client-side island and streams in after the
//    static form chrome; the form must be visible regardless.
// -----------------------------------------------------------------
{
  const suRes = await req("/sign-up");
  const suBody = await suRes.text();
  assert(suRes.status === 200, `Signed-in /sign-up returns 200 (got ${suRes.status})`);
  assert(suBody.includes("Create your account"), "Signed-in /sign-up renders the heading");
  assert(suBody.includes('id="name"'), "Signed-in /sign-up renders the name input");
  assert(suBody.includes('id="email"'), "Signed-in /sign-up renders the email input");
  assert(suBody.includes('id="password"'), "Signed-in /sign-up renders the password input");
  assert(suBody.includes("Create account"), "Signed-in /sign-up renders the submit button");
  // The "already signed in" banner is a client island, so it
  // doesn't appear in the SSR'd HTML — but the form does.
}

// -----------------------------------------------------------------
// 8) /sign-in for a signed-in user must still render the form
//    (the AlreadySignedIn client island will redirect to the
//    next URL after mount; the form is in the initial response
//    so the page is never blank).
// -----------------------------------------------------------------
{
  const siRes = await req("/sign-in");
  const siBody = await siRes.text();
  assert(siRes.status === 200, `Signed-in /sign-in returns 200 (got ${siRes.status})`);
  assert(siBody.includes("Sign in"), "Signed-in /sign-in renders the heading");
  assert(siBody.includes('id="email"'), "Signed-in /sign-in renders the email input");
  assert(siBody.includes('id="password"'), "Signed-in /sign-in renders the password input");
}

// Clean up: delete the test user
const prisma = new PrismaClient();
try {
  await prisma.user.deleteMany({ where: { email } });
  console.log("ok  : cleaned up test user");
} finally {
  await prisma.$disconnect();
}

console.log("\nSign-up flow: all assertions passed.");
